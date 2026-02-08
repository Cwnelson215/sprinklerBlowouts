import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { haversineDistance } from "@/lib/utils";
import { ServiceZone, AvailableDate, Booking } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const timeOfDay = searchParams.get("timeOfDay");
    const zoneId = searchParams.get("zoneId");

    const db = await getDb();

    // Find matching zone either by ID or by coordinates
    let matchedZoneId: ObjectId | null = zoneId ? new ObjectId(zoneId) : null;

    if (!matchedZoneId && !isNaN(lat) && !isNaN(lng)) {
      const zones = await db.collection<ServiceZone>("service_zones")
        .find({ isActive: true })
        .toArray();

      let nearestZone: ServiceZone | null = null;
      let nearestDistance = Infinity;

      for (const zone of zones) {
        const dist = haversineDistance(lat, lng, zone.centerLat, zone.centerLng);
        if (dist <= zone.radiusMi && dist < nearestDistance) {
          nearestZone = zone;
          nearestDistance = dist;
        }
      }

      matchedZoneId = nearestZone?._id ?? null;
    }

    if (!matchedZoneId) {
      return NextResponse.json(
        { error: "No service zone found for this location" },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const query: Record<string, unknown> = {
      zoneId: matchedZoneId,
      date: { $gte: today },
    };

    if (timeOfDay) {
      query.timeOfDay = timeOfDay;
    }

    const dates = await db.collection<AvailableDate>("available_dates")
      .find(query)
      .sort({ date: 1 })
      .toArray();

    // Get booking counts for each date
    const available = await Promise.all(
      dates.map(async (d) => {
        const bookingCount = await db.collection<Booking>("bookings").countDocuments({
          availableDateId: d._id,
        });

        const zone = await db.collection<ServiceZone>("service_zones").findOne({
          _id: d.zoneId,
        });

        if (bookingCount >= d.maxBookings) return null;

        return {
          id: d._id.toHexString(),
          date: d.date,
          timeOfDay: d.timeOfDay,
          zoneName: zone?.name,
          spotsRemaining: d.maxBookings - bookingCount,
        };
      })
    );

    return NextResponse.json({
      zoneId: matchedZoneId.toHexString(),
      dates: available.filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
