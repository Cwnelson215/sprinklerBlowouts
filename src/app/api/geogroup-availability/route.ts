import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ServiceZone, AvailableDate, Booking, TimeOfDay } from "@/lib/types";

// Day of week constants (0 = Sunday, 6 = Saturday)
const SATURDAY = 6;
const SUNDAY = 0;

// Helper to normalize dates that may be stored as strings or Date objects
function normalizeDate(date: Date | string): Date {
  if (typeof date === "string") {
    return new Date(date + "T00:00:00.000Z");
  }
  return date;
}

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
    const todayStr = today.toISOString().split("T")[0]; // For string date comparison

    let availableDates: Array<{
      id: string;
      date: string;
      dayOfWeek: string;
      spotsRemaining: number;
    }> = [];

    const isFirstInZone = existingBookings.length === 0;

    if (isFirstInZone) {
      // First booking in zone: Show all valid dates for the time block
      // Note: dates may be stored as strings or Date objects, so we query for both
      const dates = await db.collection<AvailableDate>("available_dates")
        .find({
          zoneId: zoneObjectId,
          timeOfDay: timeOfDay,
          $or: [
            { date: { $gte: today } },      // Date objects
            { date: { $gte: todayStr } },   // String dates
          ],
        })
        .sort({ date: 1 })
        .toArray();

      console.log("[geogroup-availability] Query params:", {
        zoneId: zoneObjectId.toHexString(),
        timeOfDay,
        today: today.toISOString(),
      });
      console.log("[geogroup-availability] Found dates from DB:", dates.length);

      // Debug: Check all dates in the collection
      const allDates = await db.collection<AvailableDate>("available_dates")
        .find({ timeOfDay: timeOfDay })
        .limit(5)
        .toArray();
      console.log("[geogroup-availability] Sample dates in DB:", allDates.map(d => ({
        zoneId: d.zoneId.toHexString(),
        date: d.date,
        dateType: typeof d.date,
      })));
      dates.forEach((d, i) => {
        const dateObj = normalizeDate(d.date);
        console.log(`  [${i}] date=${dateObj.toISOString()}, getUTCDay=${dateObj.getUTCDay()}, valid=${isValidDayForTimeSlot(dateObj, timeOfDay)}`);
      });

      // Filter by day constraints and get booking counts
      for (const d of dates) {
        const dateObj = normalizeDate(d.date);
        if (!isValidDayForTimeSlot(dateObj, timeOfDay)) {
          continue;
        }

        const bookingCount = await db.collection<Booking>("bookings").countDocuments({
          availableDateId: d._id,
          status: { $nin: ["CANCELLED"] },
        });

        if (bookingCount < d.maxBookings) {
          availableDates.push({
            id: d._id.toHexString(),
            date: dateObj.toISOString().split("T")[0],
            dayOfWeek: dateObj.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
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
            $or: [
              { date: { $gte: today } },
              { date: { $gte: todayStr } },
            ],
          })
          .sort({ date: 1 })
          .toArray();

        for (const d of dates) {
          const dateObj = normalizeDate(d.date);
          const bookingCount = await db.collection<Booking>("bookings").countDocuments({
            availableDateId: d._id,
            status: { $nin: ["CANCELLED"] },
          });

          if (bookingCount < d.maxBookings) {
            availableDates.push({
              id: d._id.toHexString(),
              date: dateObj.toISOString().split("T")[0],
              dayOfWeek: dateObj.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
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
