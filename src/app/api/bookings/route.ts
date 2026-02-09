import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validation";
import { generateJobNumber } from "@/lib/utils";
import { scheduleJob, JOBS } from "@/lib/queue";
import { Booking, AvailableDate } from "@/lib/types";
import { generateTimeSlots } from "@/lib/time-slots";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const db = await getDb();
    const bookings = db.collection<Booking>("bookings");

    // Validate bookedTime if provided with availableDateId
    if (data.availableDateId && data.bookedTime) {
      const availableDateObjectId = new ObjectId(data.availableDateId);

      // Get the available date to check validity
      const availableDate = await db
        .collection<AvailableDate>("available_dates")
        .findOne({ _id: availableDateObjectId });

      if (!availableDate) {
        return NextResponse.json(
          { error: "Selected date is no longer available" },
          { status: 400 }
        );
      }

      // Get all enabled slots for this date to validate time slot
      const dateStr =
        typeof availableDate.date === "string"
          ? availableDate.date
          : availableDate.date.toISOString().split("T")[0];

      const allSlotsForDate = await db
        .collection<AvailableDate>("available_dates")
        .find({
          zoneId: availableDate.zoneId,
          $or: [{ date: availableDate.date }, { date: dateStr as unknown as Date }],
        })
        .toArray();

      const enabledSlots = allSlotsForDate.map((slot) => slot.timeOfDay);
      const validTimeSlots = generateTimeSlots(
        availableDate.timeOfDay,
        enabledSlots
      );

      // Check if the requested time is valid for this slot
      if (!validTimeSlots.includes(data.bookedTime)) {
        return NextResponse.json(
          { error: "Invalid time selection for this time slot" },
          { status: 400 }
        );
      }

      // Check if the time is disabled by admin
      const disabledTimes = availableDate.disabledTimes || [];
      if (disabledTimes.includes(data.bookedTime)) {
        return NextResponse.json(
          { error: "This time slot has been disabled" },
          { status: 400 }
        );
      }

      // Check for race condition - is this time already booked?
      const existingBooking = await bookings.findOne({
        availableDateId: availableDateObjectId,
        bookedTime: data.bookedTime,
        status: { $nin: ["CANCELLED"] },
      });

      if (existingBooking) {
        return NextResponse.json(
          { error: "This time slot has just been booked by someone else" },
          { status: 409 }
        );
      }
    }

    // Generate unique job number
    let jobNumber: string;
    let attempts = 0;
    do {
      jobNumber = generateJobNumber();
      const existing = await bookings.findOne({ jobNumber });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique job number" },
        { status: 500 }
      );
    }

    const now = new Date();

    // If geo/zone data is provided, use it directly; otherwise leave null for async geocoding
    const hasGeoData = data.lat !== undefined && data.lng !== undefined;
    const hasDateSelection = !!data.availableDateId;

    const bookingDoc = {
      jobNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || null,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      preferredTime: data.preferredTime,
      bookedTime: data.bookedTime || null,
      notes: data.notes || null,
      status: hasDateSelection ? "SCHEDULED" : "PENDING",
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      zoneId: data.zoneId ? new ObjectId(data.zoneId) : null,
      availableDateId: data.availableDateId ? new ObjectId(data.availableDateId) : null,
      routeGroupId: null,
      routeOrder: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("bookings").insertOne(bookingDoc);
    const bookingId = result.insertedId.toHexString();

    // Only queue geocoding job if geo data wasn't provided
    if (!hasGeoData) {
      try {
        await scheduleJob(JOBS.GEOCODE_ADDRESS, { bookingId });
      } catch (err) {
        console.error("Failed to queue geocode job:", err);
      }
    }

    return NextResponse.json(
      {
        jobNumber: bookingDoc.jobNumber,
        status: bookingDoc.status,
        id: bookingId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
