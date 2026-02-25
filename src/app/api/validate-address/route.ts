import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { getDb } from "@/lib/mongodb";
import { findNearestZone } from "@/lib/utils";
import { z } from "zod";
import { withErrorHandler, parseBody } from "@/lib/api-helpers";

const addressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
});

export const POST = withErrorHandler("Error validating address", async (req: NextRequest) => {
  const { data, error } = await parseBody(req, addressSchema);
  if (error) return error;

  const { address, city, state, zip } = data;
  const result = await geocodeAddress(address, city, state, zip);

  if (!result) {
    return NextResponse.json({
      valid: false,
      error: "We couldn't verify this address. Please check the address and try again.",
    });
  }

  // Find matching zone using haversine distance
  const db = await getDb();
  const match = await findNearestZone(db, result.lat, result.lng);

  console.log("[validate-address] Geocoded:", { lat: result.lat, lng: result.lng });

  return NextResponse.json({
    valid: true,
    lat: result.lat,
    lng: result.lng,
    zoneId: match?.zone._id.toHexString() ?? null,
    zoneName: match?.zone.name ?? null,
    isInServiceArea: match !== null,
  });
});
