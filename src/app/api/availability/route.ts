import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { findNearestZone } from "@/lib/utils";
import { AvailableDate, Booking, ServiceZone } from "@/lib/types";
import { withErrorHandler } from "@/lib/api-helpers";

export const GET = withErrorHandler("Error fetching availability", async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const timeOfDay = searchParams.get("timeOfDay");
  const zoneId = searchParams.get("zoneId");

  const db = await getDb();

  // Find matching zone either by ID or by coordinates
  let matchedZoneId: ObjectId | null = zoneId ? new ObjectId(zoneId) : null;

  if (!matchedZoneId && !isNaN(lat) && !isNaN(lng)) {
    const match = await findNearestZone(db, lat, lng);
    matchedZoneId = match?.zone._id ?? null;
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
});
