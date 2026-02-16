import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getAdminFromRequest } from "@/lib/auth";
import { availableDateSchema } from "@/lib/validation";
import { AvailableDate, ServiceZone, Booking } from "@/lib/types";
import { generateTimeSlots } from "@/lib/time-slots";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId");
    const serviceType = searchParams.get("serviceType");

    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (zoneId) query.zoneId = new ObjectId(zoneId);
    if (serviceType) query.serviceType = serviceType;

    const dates = await db.collection<AvailableDate>("available_dates")
      .find(query)
      .sort({ date: 1 })
      .toArray();

    // Enrich with zone name, booking count, and booked times
    const enrichedDates = await Promise.all(
      dates.map(async (d) => {
        const [zone, bookingsForDate] = await Promise.all([
          db.collection<ServiceZone>("service_zones").findOne({ _id: d.zoneId }),
          db.collection<Booking>("bookings")
            .find({
              availableDateId: d._id,
              status: { $nin: ["CANCELLED"] },
            })
            .toArray(),
        ]);

        const bookedTimes = bookingsForDate
          .map((b) => b.bookedTime)
          .filter((t): t is string => t !== null);

        // Get all enabled slots for this date to generate time slots
        const dateStr =
          typeof d.date === "string"
            ? d.date
            : d.date.toISOString().split("T")[0];

        const allSlotsForDate = await db
          .collection<AvailableDate>("available_dates")
          .find({
            zoneId: d.zoneId,
            $or: [{ date: d.date }, { date: dateStr as unknown as Date }],
          })
          .toArray();

        const enabledSlots = allSlotsForDate.map((slot) => slot.timeOfDay);
        const allTimeSlots = generateTimeSlots(d.timeOfDay, enabledSlots);

        return {
          ...d,
          id: d._id.toHexString(),
          zoneId: d.zoneId.toHexString(),
          zone: zone ? { name: zone.name } : null,
          _count: { bookings: bookingsForDate.length },
          disabledTimes: d.disabledTimes || [],
          bookedTimes,
          allTimeSlots,
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
      serviceType: parsed.data.serviceType,
      maxBookings: parsed.data.maxBookings ?? 20,
      disabledTimes: parsed.data.disabledTimes || [],
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

const patchSchema = z.object({
  maxBookings: z.number().int().min(1).max(100).optional(),
  disabledTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional(),
});

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
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { maxBookings, disabledTimes } = parsed.data;

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {};
    if (maxBookings !== undefined) {
      updateFields.maxBookings = maxBookings;
    }
    if (disabledTimes !== undefined) {
      updateFields.disabledTimes = disabledTimes;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db.collection("available_dates").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...updateFields });
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
