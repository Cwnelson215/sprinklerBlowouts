import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validation";
import { generateJobNumber } from "@/lib/utils";
import { scheduleJob, JOBS } from "@/lib/queue";
import { Booking } from "@/lib/types";

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
      notes: data.notes || null,
      status: "PENDING",
      lat: null,
      lng: null,
      zoneId: null,
      availableDateId: null,
      routeGroupId: null,
      routeOrder: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("bookings").insertOne(bookingDoc);
    const bookingId = result.insertedId.toHexString();

    // Queue geocoding job
    try {
      await scheduleJob(JOBS.GEOCODE_ADDRESS, { bookingId });
    } catch (err) {
      console.error("Failed to queue geocode job:", err);
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
