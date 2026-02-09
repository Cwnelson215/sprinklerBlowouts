import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { getDb } from "@/lib/mongodb";
import { haversineDistance } from "@/lib/utils";
import { ServiceZone } from "@/lib/types";
import { z } from "zod";

const addressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = addressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: "Invalid address format" },
        { status: 400 }
      );
    }

    const { address, city, state, zip } = parsed.data;
    const result = await geocodeAddress(address, city, state, zip);

    if (!result) {
      return NextResponse.json({
        valid: false,
        error: "We couldn't verify this address. Please check the address and try again.",
      });
    }

    // Find matching zone using haversine distance
    const db = await getDb();
    const zones = await db.collection<ServiceZone>("service_zones")
      .find({ isActive: true })
      .toArray();

    console.log("[validate-address] Geocoded:", { lat: result.lat, lng: result.lng });
    console.log("[validate-address] Active zones found:", zones.length);

    let matchedZone: ServiceZone | null = null;
    let nearestDistance = Infinity;

    for (const zone of zones) {
      const dist = haversineDistance(result.lat, result.lng, zone.centerLat, zone.centerLng);
      console.log(`[validate-address] Zone "${zone.name}": center=(${zone.centerLat}, ${zone.centerLng}), radius=${zone.radiusMi}mi, distance=${dist.toFixed(2)}mi`);
      if (dist <= zone.radiusMi && dist < nearestDistance) {
        matchedZone = zone;
        nearestDistance = dist;
      }
    }

    return NextResponse.json({
      valid: true,
      lat: result.lat,
      lng: result.lng,
      zoneId: matchedZone?._id.toHexString() ?? null,
      zoneName: matchedZone?.name ?? null,
      isInServiceArea: matchedZone !== null,
    });
  } catch (error) {
    console.error("Error validating address:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate address" },
      { status: 500 }
    );
  }
}
