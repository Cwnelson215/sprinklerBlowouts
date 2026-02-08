import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getAdminFromRequest } from "@/lib/auth";
import { availableDateSchema } from "@/lib/validation";
import { AvailableDate, ServiceZone, Booking } from "@/lib/types";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId");

    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (zoneId) query.zoneId = new ObjectId(zoneId);

    const dates = await db.collection<AvailableDate>("available_dates")
      .find(query)
      .sort({ date: 1 })
      .toArray();

    // Enrich with zone name and booking count
    const enrichedDates = await Promise.all(
      dates.map(async (d) => {
        const [zone, bookingCount] = await Promise.all([
          db.collection<ServiceZone>("service_zones").findOne({ _id: d.zoneId }),
          db.collection<Booking>("bookings").countDocuments({ availableDateId: d._id }),
        ]);

        return {
          ...d,
          id: d._id.toHexString(),
          zoneId: d.zoneId.toHexString(),
          zone: zone ? { name: zone.name } : null,
          _count: { bookings: bookingCount },
        };
      })
    );

    return NextResponse.json(enrichedDates);
  } catch (error) {
    console.error("Availability list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = availableDateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const db = await getDb();
    const dateDoc = {
      zoneId: new ObjectId(parsed.data.zoneId),
      date: new Date(parsed.data.date),
      timeOfDay: parsed.data.timeOfDay,
      maxBookings: parsed.data.maxBookings ?? 20,
      createdAt: new Date(),
    };

    const result = await db.collection("available_dates").insertOne(dateDoc);

    return NextResponse.json(
      { ...dateDoc, _id: result.insertedId, id: result.insertedId.toHexString() },
      { status: 201 }
    );
  } catch (error) {
    console.error("Availability create error:", error);
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = await req.json();
    const { maxBookings } = body;

    if (typeof maxBookings !== "number" || maxBookings < 1 || maxBookings > 100) {
      return NextResponse.json(
        { error: "maxBookings must be a number between 1 and 100" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db.collection("available_dates").updateOne(
      { _id: new ObjectId(id) },
      { $set: { maxBookings } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, maxBookings });
  } catch (error) {
    console.error("Availability update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = await getDb();
    const availableDateId = new ObjectId(id);

    // Update bookings that reference this date
    await db.collection("bookings").updateMany(
      { availableDateId },
      { $set: { availableDateId: null, status: "AWAITING_SCHEDULE" } }
    );
    await db.collection("available_dates").deleteOne({ _id: availableDateId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Availability delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
