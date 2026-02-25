import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { bookingUpdateSchema } from "@/lib/validation";
import { scheduleJob, JOBS } from "@/lib/queue";
import { Booking, AvailableDate, ServiceZone } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return `**@${domain || "***"}`;
  return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
}

function maskPhoneSimple(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 6) return phone;
  const visible = cleaned.slice(0, 2) + "*".repeat(cleaned.length - 6) + cleaned.slice(-4);
  return visible;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`lookup:${ip}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
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
      customerPhone: maskPhoneSimple(booking.customerPhone),
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
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const { jobNumber } = await params;

  const rl = checkRateLimit(`update:${jobNumber}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many update attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = bookingUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

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

    if (parsed.data.customerName) updateData.customerName = parsed.data.customerName;
    if (parsed.data.customerEmail) updateData.customerEmail = parsed.data.customerEmail;
    if (parsed.data.customerPhone !== undefined) updateData.customerPhone = parsed.data.customerPhone;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    if (parsed.data.status === "CANCELLED") {
      updateData.status = "CANCELLED";
      updateData.availableDateId = null;
      updateData.routeGroupId = null;
      updateData.routeOrder = null;
    }

    if (parsed.data.availableDateId) {
      // Verify the available date exists and has capacity
      const availableDateId = new ObjectId(parsed.data.availableDateId);
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
    if (parsed.data.availableDateId && updated) {
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
    if (parsed.data.status === "CANCELLED" && updated) {
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
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
