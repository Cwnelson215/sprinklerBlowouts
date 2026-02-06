import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getAdminFromRequest } from "@/lib/auth";
import { Booking, ServiceZone, AvailableDate, BookingStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const zoneId = searchParams.get("zoneId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (zoneId) query.zoneId = new ObjectId(zoneId);
    if (search) {
      query.$or = [
        { jobNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    const [bookings, total] = await Promise.all([
      db.collection<Booking>("bookings")
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection<Booking>("bookings").countDocuments(query),
    ]);

    // Populate zone and availableDate info
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        let zone: ServiceZone | null = null;
        let availableDate: AvailableDate | null = null;

        if (booking.zoneId) {
          zone = await db.collection<ServiceZone>("service_zones").findOne({
            _id: booking.zoneId,
          });
        }

        if (booking.availableDateId) {
          availableDate = await db.collection<AvailableDate>("available_dates").findOne({
            _id: booking.availableDateId,
          });
        }

        return {
          ...booking,
          id: booking._id.toHexString(),
          zone: zone ? { name: zone.name } : null,
          availableDate: availableDate
            ? { date: availableDate.date, timeOfDay: availableDate.timeOfDay }
            : null,
        };
      })
    );

    return NextResponse.json({
      bookings: enrichedBookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin bookings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db.collection<Booking>("bookings").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ ...result, id: result._id.toHexString() });
  } catch (error) {
    console.error("Admin booking update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = await getDb();
    await db.collection<Booking>("bookings").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin booking delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
