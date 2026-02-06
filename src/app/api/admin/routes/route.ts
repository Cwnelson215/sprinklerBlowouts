import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";
import { scheduleJob, JOBS } from "@/lib/queue";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId");
    const date = searchParams.get("date");

    const where: Record<string, unknown> = {};
    if (zoneId) where.zoneId = zoneId;
    if (date) where.date = new Date(date);

    const routes = await prisma.routeGroup.findMany({
      where,
      include: {
        zone: { select: { name: true } },
        bookings: {
          select: {
            id: true,
            jobNumber: true,
            customerName: true,
            address: true,
            lat: true,
            lng: true,
            routeOrder: true,
            status: true,
          },
          orderBy: { routeOrder: "asc" },
        },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error("Routes list error:", error);
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
    const { zoneId, date } = body;

    await scheduleJob(JOBS.OPTIMIZE_ROUTES, {
      zoneId: zoneId || undefined,
      date: date || undefined,
    });

    return NextResponse.json({ message: "Route optimization queued" });
  } catch (error) {
    console.error("Route optimization error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
