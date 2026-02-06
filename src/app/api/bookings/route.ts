import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/validation";
import { generateJobNumber } from "@/lib/utils";
import { scheduleJob, JOBS } from "@/lib/queue";

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

    // Generate unique job number
    let jobNumber: string;
    let attempts = 0;
    do {
      jobNumber = generateJobNumber();
      const existing = await prisma.booking.findUnique({ where: { jobNumber } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique job number" },
        { status: 500 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        jobNumber,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        preferredTime: data.preferredTime,
        notes: data.notes,
        status: "PENDING",
      },
    });

    // Queue geocoding job
    try {
      await scheduleJob(JOBS.GEOCODE_ADDRESS, { bookingId: booking.id });
    } catch (err) {
      console.error("Failed to queue geocode job:", err);
    }

    return NextResponse.json(
      {
        jobNumber: booking.jobNumber,
        status: booking.status,
        id: booking.id,
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
