import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { withAdmin } from "@/lib/api-helpers";
import { Booking, ServiceZone, AvailableDate, BookingStatus } from "@/lib/types";
import { escapeRegex, clampPagination, isValidObjectId } from "@/lib/security";

const VALID_STATUSES = Object.values(BookingStatus);

export const GET = withAdmin("Admin bookings error", async (req, _admin) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const zoneId = searchParams.get("zoneId");
  const serviceType = searchParams.get("serviceType");
  const search = searchParams.get("search");
  const { page, limit } = clampPagination(
    searchParams.get("page"),
    searchParams.get("limit")
  );

  const db = await getDb();
  const query: Record<string, unknown> = {};

  if (status) {
    if (!VALID_STATUSES.includes(status as BookingStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    query.status = status;
  }
  if (zoneId) {
    if (!isValidObjectId(zoneId)) {
      return NextResponse.json({ error: "Invalid zoneId" }, { status: 400 });
    }
    query.zoneId = new ObjectId(zoneId);
  }
  if (serviceType) query.serviceType = serviceType;
  if (search) {
    const escaped = escapeRegex(search);
    query.$or = [
      { jobNumber: { $regex: escaped, $options: "i" } },
      { customerName: { $regex: escaped, $options: "i" } },
      { customerEmail: { $regex: escaped, $options: "i" } },
      { address: { $regex: escaped, $options: "i" } },
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
});

export const PATCH = withAdmin("Admin booking update error", async (req, _admin) => {
  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(status as BookingStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
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
});

export const DELETE = withAdmin("Admin booking delete error", async (req, _admin) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection<Booking>("bookings").deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ ok: true });
}, { requireSuperAdmin: true });
