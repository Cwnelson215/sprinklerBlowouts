import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validation";
import { generateJobNumber } from "@/lib/utils";
import { getServiceConfig } from "@/lib/service-config";
import { scheduleJob, JOBS } from "@/lib/queue";
import { Booking, AvailableDate, ServiceType } from "@/lib/types";
import { generateTimeSlots } from "@/lib/time-slots";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`booking:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many booking requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

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
          serviceType: data.serviceType,
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

      // Check for existing booking at this time slot
      // NOTE: A MongoDB unique partial index on {availableDateId, bookedTime}
      // where status != "CANCELLED" would fully prevent race conditions here.
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
    const jobPrefix = getServiceConfig(data.serviceType as ServiceType).jobPrefix;
    let jobNumber: string;
    let attempts = 0;
    do {
      jobNumber = generateJobNumber(jobPrefix);
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
      serviceType: data.serviceType,
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

    // Queue route group assignment if booking has geo data, a date, and a zone
    if (hasGeoData && hasDateSelection && data.zoneId) {
      try {
        await scheduleJob(JOBS.ASSIGN_ROUTE_GROUP, { bookingId });
      } catch (err) {
        console.error("Failed to queue route assignment job:", err);
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
