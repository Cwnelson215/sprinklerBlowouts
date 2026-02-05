import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";
import { availableDateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId");

    const where: Record<string, unknown> = {};
    if (zoneId) where.zoneId = zoneId;

    const dates = await prisma.availableDate.findMany({
      where,
      include: {
        zone: { select: { name: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(dates);
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

    const date = await prisma.availableDate.create({
      data: {
        zoneId: parsed.data.zoneId,
        date: new Date(parsed.data.date),
        timeOfDay: parsed.data.timeOfDay,
        maxBookings: parsed.data.maxBookings,
      },
    });

    return NextResponse.json(date, { status: 201 });
  } catch (error) {
    console.error("Availability create error:", error);
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

    await prisma.availableDate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Availability delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
