import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ServiceZone, AvailableDate, Booking, TimeOfDay, ServiceType } from "@/lib/types";
import { generateTimeSlots, getAvailableTimes } from "@/lib/time-slots";
import { withErrorHandler } from "@/lib/api-helpers";

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

export const GET = withErrorHandler("Error fetching geogroup availability", async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const zoneId = searchParams.get("zoneId");
  const timeOfDay = searchParams.get("timeOfDay") as TimeOfDay | null;
  const serviceType = searchParams.get("serviceType");

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

  if (!serviceType || !["SPRINKLER_BLOWOUT", "BACKFLOW_TESTING"].includes(serviceType)) {
    return NextResponse.json(
      { error: "Valid serviceType is required (SPRINKLER_BLOWOUT or BACKFLOW_TESTING)" },
      { status: 400 }
    );
  }

  const showAll = searchParams.get("showAll") === "true";

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

  // Check for existing bookings in this zone with matching timeOfDay and serviceType
  const existingBookings = await db.collection<Booking>("bookings")
    .find({
      zoneId: zoneObjectId,
      preferredTime: timeOfDay,
      serviceType: serviceType as ServiceType,
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
    availableTimes: string[];
  }> = [];

  const isFirstInZone = existingBookings.length === 0;

  // Helper to calculate available times for a date
  async function calculateAvailableTimesForDate(
    d: AvailableDate,
    dateStr: string
  ): Promise<string[]> {
    // Get all enabled slots for this date to calculate cross-slot spacing
    const allSlotsForDate = await db
      .collection<AvailableDate>("available_dates")
      .find({
        zoneId: d.zoneId,
        serviceType: serviceType as ServiceType,
        $or: [
          { date: normalizeDate(d.date) },
          { date: dateStr as unknown as Date },
        ],
      })
      .toArray();

    const enabledSlots = allSlotsForDate.map((slot) => slot.timeOfDay);

    // Generate all possible time slots
    const allTimeSlots = generateTimeSlots(d.timeOfDay, enabledSlots);

    // Get booked times for this date
    const bookingsForDate = await db
      .collection<Booking>("bookings")
      .find({
        availableDateId: d._id,
        status: { $nin: ["CANCELLED"] },
        bookedTime: { $ne: null },
      })
      .toArray();

    const bookedTimes = bookingsForDate
      .map((b) => b.bookedTime)
      .filter((t): t is string => t !== null);

    // Get admin-disabled times
    const disabledTimes = d.disabledTimes || [];

    // Calculate available times
    return getAvailableTimes(
      d.timeOfDay,
      enabledSlots,
      bookedTimes,
      disabledTimes
    );
  }

  if (isFirstInZone || showAll) {
    // First booking in zone: Show all valid dates for the time block
    // Note: dates may be stored as strings or Date objects, so we query for both
    const dates = await db.collection<AvailableDate>("available_dates")
      .find({
        zoneId: zoneObjectId,
        timeOfDay: timeOfDay,
        serviceType: serviceType as ServiceType,
        $or: [
          { date: { $gte: today } },      // Date objects
          { date: { $gte: todayStr as unknown as Date } },   // String dates
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

    // Filter by day constraints and calculate available times
    for (const d of dates) {
      const dateObj = normalizeDate(d.date);
      if (!isValidDayForTimeSlot(dateObj, timeOfDay)) {
        continue;
      }

      const dateStr = dateObj.toISOString().split("T")[0];
      const availableTimesForDate = await calculateAvailableTimesForDate(d, dateStr);

      // Only include dates that have at least one available time
      if (availableTimesForDate.length > 0) {
        availableDates.push({
          id: d._id.toHexString(),
          date: dateStr,
          dayOfWeek: dateObj.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
          spotsRemaining: availableTimesForDate.length,
          availableTimes: availableTimesForDate,
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
            { date: { $gte: todayStr as unknown as Date } },
          ],
        })
        .sort({ date: 1 })
        .toArray();

      for (const d of dates) {
        const dateObj = normalizeDate(d.date);
        const dateStr = dateObj.toISOString().split("T")[0];
        const availableTimesForDate = await calculateAvailableTimesForDate(d, dateStr);

        // Only include dates that have at least one available time
        if (availableTimesForDate.length > 0) {
          availableDates.push({
            id: d._id.toHexString(),
            date: dateStr,
            dayOfWeek: dateObj.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
            spotsRemaining: availableTimesForDate.length,
            availableTimes: availableTimesForDate,
          });
        }
      }
    }

    // Fallback: if all geo-grouped dates are fully booked, show all valid dates
    // (same behavior as first-in-zone) so the customer isn't stuck
    if (availableDates.length === 0) {
      const fallbackDates = await db.collection<AvailableDate>("available_dates")
        .find({
          zoneId: zoneObjectId,
          timeOfDay: timeOfDay,
          serviceType: serviceType as ServiceType,
          $or: [
            { date: { $gte: today } },
            { date: { $gte: todayStr as unknown as Date } },
          ],
        })
        .sort({ date: 1 })
        .toArray();

      for (const d of fallbackDates) {
        const dateObj = normalizeDate(d.date);
        if (!isValidDayForTimeSlot(dateObj, timeOfDay)) {
          continue;
        }

        const dateStr = dateObj.toISOString().split("T")[0];
        const availableTimesForDate = await calculateAvailableTimesForDate(d, dateStr);

        if (availableTimesForDate.length > 0) {
          availableDates.push({
            id: d._id.toHexString(),
            date: dateStr,
            dayOfWeek: dateObj.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
            spotsRemaining: availableTimesForDate.length,
            availableTimes: availableTimesForDate,
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
});
