import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ServiceZone, AvailableDate, Booking, TimeOfDay } from "@/lib/types";

// Day of week constants (0 = Sunday, 6 = Saturday)
const SATURDAY = 6;
const SUNDAY = 0;

function isValidDayForTimeSlot(date: Date, timeOfDay: TimeOfDay): boolean {
  const dayOfWeek = date.getUTCDay();

  // No appointments on Sundays
  if (dayOfWeek === SUNDAY) {
    return false;
  }

  // Morning: Saturdays only
  if (timeOfDay === "MORNING") {
    return dayOfWeek === SATURDAY;
  }

  // Afternoon/Evening: Weekdays + Saturdays (no Sundays - already filtered above)
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId");
    const timeOfDay = searchParams.get("timeOfDay") as TimeOfDay | null;

    if (!zoneId) {
      return NextResponse.json(
        { error: "zoneId is required" },
        { status: 400 }
      );
    }

    if (!timeOfDay || !["MORNING", "AFTERNOON", "EVENING"].includes(timeOfDay)) {
      return NextResponse.json(
        { error: "Valid timeOfDay is required (MORNING, AFTERNOON, or EVENING)" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const zoneObjectId = new ObjectId(zoneId);

    // Verify zone exists
    const zone = await db.collection<ServiceZone>("service_zones").findOne({
      _id: zoneObjectId,
      isActive: true,
    });

    if (!zone) {
      return NextResponse.json(
        { error: "Zone not found" },
        { status: 404 }
      );
    }

    // Check for existing bookings in this zone with matching timeOfDay
    const existingBookings = await db.collection<Booking>("bookings")
      .find({
        zoneId: zoneObjectId,
        preferredTime: timeOfDay,
        status: { $in: ["SCHEDULED", "CONFIRMED"] },
        availableDateId: { $ne: null },
      })
      .toArray();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let availableDates: Array<{
      id: string;
      date: string;
      dayOfWeek: string;
      spotsRemaining: number;
    }> = [];

    const isFirstInZone = existingBookings.length === 0;

    if (isFirstInZone) {
      // First booking in zone: Show all valid dates for the time block
      const dates = await db.collection<AvailableDate>("available_dates")
        .find({
          zoneId: zoneObjectId,
          timeOfDay: timeOfDay,
          date: { $gte: today },
        })
        .sort({ date: 1 })
        .toArray();

      // Filter by day constraints and get booking counts
      for (const d of dates) {
        if (!isValidDayForTimeSlot(d.date, timeOfDay)) {
          continue;
        }

        const bookingCount = await db.collection<Booking>("bookings").countDocuments({
          availableDateId: d._id,
          status: { $nin: ["CANCELLED"] },
        });

        if (bookingCount < d.maxBookings) {
          availableDates.push({
            id: d._id.toHexString(),
            date: d.date.toISOString().split("T")[0],
            dayOfWeek: d.date.toLocaleDateString("en-US", { weekday: "long" }),
            spotsRemaining: d.maxBookings - bookingCount,
          });
        }
      }
    } else {
      // Subsequent bookings: Only show dates matching existing bookings in the zone
      const existingDateIds = [...new Set(
        existingBookings
          .filter(b => b.availableDateId)
          .map(b => b.availableDateId!.toHexString())
      )];

      if (existingDateIds.length > 0) {
        const dates = await db.collection<AvailableDate>("available_dates")
          .find({
            _id: { $in: existingDateIds.map(id => new ObjectId(id)) },
            date: { $gte: today },
          })
          .sort({ date: 1 })
          .toArray();

        for (const d of dates) {
          const bookingCount = await db.collection<Booking>("bookings").countDocuments({
            availableDateId: d._id,
            status: { $nin: ["CANCELLED"] },
          });

          if (bookingCount < d.maxBookings) {
            availableDates.push({
              id: d._id.toHexString(),
              date: d.date.toISOString().split("T")[0],
              dayOfWeek: d.date.toLocaleDateString("en-US", { weekday: "long" }),
              spotsRemaining: d.maxBookings - bookingCount,
            });
          }
        }
      }
    }

    return NextResponse.json({
      zoneId: zone._id.toHexString(),
      zoneName: zone.name,
      isFirstInZone,
      availableDates,
    });
  } catch (error) {
    console.error("Error fetching geogroup availability:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
