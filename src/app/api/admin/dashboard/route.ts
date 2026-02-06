import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getAdminFromRequest } from "@/lib/auth";
import { Booking, ServiceZone, AvailableDate } from "@/lib/types";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const bookingsCol = db.collection<Booking>("bookings");
    const zonesCol = db.collection<ServiceZone>("service_zones");
    const datesCol = db.collection<AvailableDate>("available_dates");

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
      bookingsCol.countDocuments(),
      bookingsCol.countDocuments({ status: { $in: ["PENDING", "AWAITING_SCHEDULE"] } }),
      bookingsCol.countDocuments({ status: { $in: ["SCHEDULED", "CONFIRMED"] } }),
      bookingsCol.countDocuments({ status: "COMPLETED" }),
      bookingsCol.countDocuments({ status: "CANCELLED" }),
      zonesCol.countDocuments({ isActive: true }),
      datesCol.countDocuments({ date: { $gte: new Date() } }),
      bookingsCol
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    // Enrich recent bookings with zone names
    const enrichedRecentBookings = await Promise.all(
      recentBookings.map(async (booking) => {
        let zoneName: string | null = null;
        if (booking.zoneId) {
          const zone = await zonesCol.findOne({ _id: booking.zoneId });
          zoneName = zone?.name ?? null;
        }
        return {
          jobNumber: booking.jobNumber,
          customerName: booking.customerName,
          status: booking.status,
          createdAt: booking.createdAt,
          zone: zoneName ? { name: zoneName } : null,
        };
      })
    );

    // Bookings per day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookingsByDay = await bookingsCol.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

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
      recentBookings: enrichedRecentBookings,
      bookingsByDay: bookingsByDay.map((d) => ({
        date: d._id,
        _count: d.count,
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
