import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      totalBookings,
      pendingBookings,
      scheduledBookings,
      completedBookings,
      cancelledBookings,
      activeZones,
      upcomingDates,
      recentBookings,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: { in: ["PENDING", "AWAITING_SCHEDULE"] } } }),
      prisma.booking.count({ where: { status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
      prisma.booking.count({ where: { status: "CANCELLED" } }),
      prisma.serviceZone.count({ where: { isActive: true } }),
      prisma.availableDate.count({ where: { date: { gte: new Date() } } }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          jobNumber: true,
          customerName: true,
          status: true,
          createdAt: true,
          zone: { select: { name: true } },
        },
      }),
    ]);

    // Bookings per day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookingsByDay = await prisma.booking.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    });

    return NextResponse.json({
      stats: {
        totalBookings,
        pendingBookings,
        scheduledBookings,
        completedBookings,
        cancelledBookings,
        activeZones,
        upcomingDates,
      },
      recentBookings,
      bookingsByDay,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
