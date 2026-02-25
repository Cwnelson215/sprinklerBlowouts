import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { bookingUpdateSchema } from "@/lib/validation";
import { scheduleJob, JOBS } from "@/lib/queue";
import { Booking, AvailableDate, ServiceZone } from "@/lib/types";
import { maskEmail, maskPhone } from "@/lib/security";
import { withErrorHandler, parseBody, applyRateLimit } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const GET = withErrorHandler("Error fetching booking", async (
  req: NextRequest,
  ...args: unknown[]
) => {
  const rateLimited = applyRateLimit(req, "lookup", 30, 60 * 1000);
  if (rateLimited) return rateLimited;

  const { params } = args[0] as { params: Promise<{ jobNumber: string }> };
  const { jobNumber } = await params;
  const db = await getDb();

  const booking = await db.collection<Booking>("bookings").findOne({ jobNumber });

  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  let availableDate: AvailableDate | null = null;
  let zone: ServiceZone | null = null;

  if (booking.availableDateId) {
    availableDate = await db.collection<AvailableDate>("available_dates").findOne({
      _id: booking.availableDateId,
    });
  }

  if (booking.zoneId) {
    zone = await db.collection<ServiceZone>("service_zones").findOne({
      _id: booking.zoneId,
    });
  }

  return NextResponse.json({
    jobNumber: booking.jobNumber,
    serviceType: booking.serviceType,
    customerName: booking.customerName,
    customerEmail: maskEmail(booking.customerEmail),
    customerPhone: maskPhone(booking.customerPhone),
    address: booking.address,
    city: booking.city,
    state: booking.state,
    zip: booking.zip,
    preferredTime: booking.preferredTime,
    status: booking.status,
    notes: booking.notes,
    zoneName: zone?.name,
    scheduledDate: availableDate?.date,
    scheduledTime: availableDate?.timeOfDay,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  });
});

export const PATCH = withErrorHandler("Error updating booking", async (
  req: NextRequest,
  ...args: unknown[]
) => {
  const { params } = args[0] as { params: Promise<{ jobNumber: string }> };
  const { jobNumber } = await params;

  const rl = checkRateLimit(`update:${jobNumber}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many update attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  const { data, error } = await parseBody(req, bookingUpdateSchema);
  if (error) return error;

  const db = await getDb();
  const bookings = db.collection<Booking>("bookings");

  const booking = await bookings.findOne({ jobNumber });

  if (!booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  if (booking.status === "COMPLETED" || booking.status === "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Cannot modify a booking that is in progress or completed" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.customerName) updateData.customerName = data.customerName;
  if (data.customerEmail) updateData.customerEmail = data.customerEmail;
  if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.status === "CANCELLED") {
    updateData.status = "CANCELLED";
    updateData.availableDateId = null;
    updateData.routeGroupId = null;
    updateData.routeOrder = null;
  }

  if (data.availableDateId) {
    // Verify the available date exists and has capacity
    const availableDateId = new ObjectId(data.availableDateId);
    const availableDate = await db.collection<AvailableDate>("available_dates").findOne({
      _id: availableDateId,
    });

    if (!availableDate) {
      return NextResponse.json(
        { error: "Selected date not available" },
        { status: 400 }
      );
    }

    const bookingCount = await bookings.countDocuments({
      availableDateId: availableDateId,
    });

    if (bookingCount >= availableDate.maxBookings) {
      return NextResponse.json(
        { error: "Selected date is full" },
        { status: 400 }
      );
    }

    updateData.availableDateId = availableDateId;
    updateData.status = "SCHEDULED";
  }

  await bookings.updateOne({ jobNumber }, { $set: updateData });
  const updated = await bookings.findOne({ jobNumber });

  // Queue route assignment if a date was selected
  if (data.availableDateId && updated) {
    try {
      await scheduleJob(JOBS.ASSIGN_ROUTE_GROUP, { bookingId: updated._id.toHexString() });
      await scheduleJob(JOBS.SEND_EMAIL, {
        bookingId: updated._id.toHexString(),
        emailType: "CONFIRMATION",
      });
    } catch (err) {
      console.error("Failed to queue jobs:", err);
    }
  }

  // Queue cancellation email
  if (data.status === "CANCELLED" && updated) {
    try {
      await scheduleJob(JOBS.SEND_EMAIL, {
        bookingId: updated._id.toHexString(),
        emailType: "CANCELLATION",
      });
    } catch (err) {
      console.error("Failed to queue cancellation email:", err);
    }
  }

  return NextResponse.json({
    jobNumber: updated?.jobNumber,
    status: updated?.status,
  });
});
