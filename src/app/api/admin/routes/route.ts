import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getAdminFromRequest } from "@/lib/auth";
import { scheduleJob, JOBS } from "@/lib/queue";
import { RouteGroup, ServiceZone, Booking } from "@/lib/types";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get("zoneId");
    const date = searchParams.get("date");
    const serviceType = searchParams.get("serviceType");

    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (zoneId) query.zoneId = new ObjectId(zoneId);
    if (date) query.date = new Date(date);
    if (serviceType) query.serviceType = serviceType;

    const routes = await db.collection<RouteGroup>("route_groups")
      .find(query)
      .sort({ date: 1 })
      .toArray();

    // Enrich with zone and bookings info
    const enrichedRoutes = await Promise.all(
      routes.map(async (route) => {
        const [zone, bookings] = await Promise.all([
          db.collection<ServiceZone>("service_zones").findOne({ _id: route.zoneId }),
          db.collection<Booking>("bookings")
            .find({ routeGroupId: route._id })
            .sort({ routeOrder: 1 })
            .toArray(),
        ]);

        return {
          ...route,
          id: route._id.toHexString(),
          zone: zone ? { name: zone.name } : null,
          bookings: bookings.map((b) => ({
            id: b._id.toHexString(),
            jobNumber: b.jobNumber,
            customerName: b.customerName,
            address: b.address,
            city: b.city,
            state: b.state,
            zip: b.zip,
            lat: b.lat,
            lng: b.lng,
            routeOrder: b.routeOrder,
            status: b.status,
          })),
        };
      })
    );

    return NextResponse.json(enrichedRoutes);
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
    const { zoneId, date, serviceType: bodyServiceType } = body;

    await scheduleJob(JOBS.OPTIMIZE_ROUTES, {
      zoneId: zoneId || undefined,
      date: date || undefined,
      serviceType: bodyServiceType || undefined,
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
