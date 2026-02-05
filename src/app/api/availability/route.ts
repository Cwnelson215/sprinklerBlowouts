import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const timeOfDay = searchParams.get("timeOfDay");
    const zoneId = searchParams.get("zoneId");

    // Find matching zone either by ID or by coordinates
    let matchedZoneId: string | null = zoneId;

    if (!matchedZoneId && !isNaN(lat) && !isNaN(lng)) {
      const zones = await prisma.serviceZone.findMany({
        where: { isActive: true },
      });

      let nearestZone: (typeof zones)[0] | null = null;
      let nearestDistance = Infinity;

      for (const zone of zones) {
        const dist = haversineDistance(lat, lng, zone.centerLat, zone.centerLng);
        if (dist <= zone.radiusMi && dist < nearestDistance) {
          nearestZone = zone;
          nearestDistance = dist;
        }
      }

      matchedZoneId = nearestZone?.id ?? null;
    }

    if (!matchedZoneId) {
      return NextResponse.json(
        { error: "No service zone found for this location" },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = {
      zoneId: matchedZoneId,
      date: { gte: new Date() },
    };

    if (timeOfDay) {
      where.timeOfDay = timeOfDay;
    }

    const dates = await prisma.availableDate.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
        zone: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    const available = dates
      .filter((d) => d._count.bookings < d.maxBookings)
      .map((d) => ({
        id: d.id,
        date: d.date,
        timeOfDay: d.timeOfDay,
        zoneName: d.zone.name,
        spotsRemaining: d.maxBookings - d._count.bookings,
      }));

    return NextResponse.json({ zoneId: matchedZoneId, dates: available });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
