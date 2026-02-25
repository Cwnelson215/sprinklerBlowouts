import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { withAdmin, parseBody } from "@/lib/api-helpers";
import { zoneSchema } from "@/lib/validation";
import { ServiceZone, Booking, AvailableDate } from "@/lib/types";

export const GET = withAdmin("Zone list error", async (_req, _admin) => {
  const db = await getDb();
  const zones = await db.collection<ServiceZone>("service_zones")
    .find()
    .sort({ name: 1 })
    .toArray();

  // Get counts for each zone
  const enrichedZones = await Promise.all(
    zones.map(async (zone) => {
      const [bookingsCount, availableDatesCount] = await Promise.all([
        db.collection<Booking>("bookings").countDocuments({ zoneId: zone._id }),
        db.collection<AvailableDate>("available_dates").countDocuments({ zoneId: zone._id }),
      ]);

      return {
        ...zone,
        id: zone._id.toHexString(),
        _count: {
          bookings: bookingsCount,
          availableDates: availableDatesCount,
        },
      };
    })
  );

  return NextResponse.json(enrichedZones);
});

export const POST = withAdmin("Zone create error", async (req, _admin) => {
  const { data, error } = await parseBody(req, zoneSchema);
  if (error) return error;

  const db = await getDb();
  const now = new Date();
  const zoneDoc = {
    ...data,
    radiusMi: data.radiusMi ?? 15,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("service_zones").insertOne(zoneDoc);

  return NextResponse.json(
    { ...zoneDoc, _id: result.insertedId, id: result.insertedId.toHexString() },
    { status: 201 }
  );
});

export const PATCH = withAdmin("Zone update error", async (req, _admin) => {
  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection<ServiceZone>("service_zones").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  return NextResponse.json({ ...result, id: result._id.toHexString() });
});

export const DELETE = withAdmin("Zone delete error", async (req, _admin) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = await getDb();
  const zoneId = new ObjectId(id);

  // Delete related available dates and update bookings
  await db.collection("available_dates").deleteMany({ zoneId });
  await db.collection("bookings").updateMany(
    { zoneId },
    { $set: { zoneId: null } }
  );
  await db.collection("service_zones").deleteOne({ _id: zoneId });

  return NextResponse.json({ ok: true });
}, { requireSuperAdmin: true });
