import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingUpdateSchema } from "@/lib/validation";
import { scheduleJob, JOBS } from "@/lib/queue";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  try {
    const { jobNumber } = await params;
    const booking = await prisma.booking.findUnique({
      where: { jobNumber },
      include: {
        availableDate: true,
        zone: { select: { name: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      jobNumber: booking.jobNumber,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      address: booking.address,
      city: booking.city,
      state: booking.state,
      zip: booking.zip,
      preferredTime: booking.preferredTime,
      status: booking.status,
      notes: booking.notes,
      zoneName: booking.zone?.name,
      scheduledDate: booking.availableDate?.date,
      scheduledTime: booking.availableDate?.timeOfDay,
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
  try {
    const { jobNumber } = await params;
    const body = await req.json();
    const parsed = bookingUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { jobNumber },
    });

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

    const updateData: Record<string, unknown> = {};

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
      const availableDate = await prisma.availableDate.findUnique({
        where: { id: parsed.data.availableDateId },
        include: { _count: { select: { bookings: true } } },
      });

      if (!availableDate) {
        return NextResponse.json(
          { error: "Selected date not available" },
          { status: 400 }
        );
      }

      if (availableDate._count.bookings >= availableDate.maxBookings) {
        return NextResponse.json(
          { error: "Selected date is full" },
          { status: 400 }
        );
      }

      updateData.availableDateId = parsed.data.availableDateId;
      updateData.status = "SCHEDULED";
    }

    const updated = await prisma.booking.update({
      where: { jobNumber },
      data: updateData,
    });

    // Queue route assignment if a date was selected
    if (parsed.data.availableDateId) {
      try {
        await scheduleJob(JOBS.ASSIGN_ROUTE_GROUP, { bookingId: updated.id });
        await scheduleJob(JOBS.SEND_EMAIL, {
          bookingId: updated.id,
          emailType: "CONFIRMATION",
        });
      } catch (err) {
        console.error("Failed to queue jobs:", err);
      }
    }

    // Queue cancellation email
    if (parsed.data.status === "CANCELLED") {
      try {
        await scheduleJob(JOBS.SEND_EMAIL, {
          bookingId: updated.id,
          emailType: "CANCELLATION",
        });
      } catch (err) {
        console.error("Failed to queue cancellation email:", err);
      }
    }

    return NextResponse.json({
      jobNumber: updated.jobNumber,
      status: updated.status,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
