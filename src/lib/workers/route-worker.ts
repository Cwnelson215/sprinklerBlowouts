import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { dbscan } from "../clustering";
import { optimizeRoute } from "../route-optimizer";

interface AssignRouteGroupData {
  bookingId: string;
}

interface OptimizeRoutesData {
  zoneId?: string;
  date?: string;
  recurring?: boolean;
  cron?: string;
  timezone?: string;
}

export async function handleAssignRouteGroup(data: AssignRouteGroupData) {
  const { bookingId } = data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { availableDate: true },
  });

  if (!booking || !booking.availableDate || !booking.zoneId || !booking.lat || !booking.lng) {
    console.error(`Cannot assign route group for booking ${bookingId}: missing data`);
    return;
  }

  // Find or create a route group for this zone/date/time
  let routeGroup = await prisma.routeGroup.findFirst({
    where: {
      zoneId: booking.zoneId,
      date: booking.availableDate.date,
      timeOfDay: booking.availableDate.timeOfDay,
    },
  });

  if (!routeGroup) {
    routeGroup = await prisma.routeGroup.create({
      data: {
        zoneId: booking.zoneId,
        date: booking.availableDate.date,
        timeOfDay: booking.availableDate.timeOfDay,
      },
    });
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      routeGroupId: routeGroup.id,
      status: "SCHEDULED",
    },
  });

  // Update house count
  const count = await prisma.booking.count({
    where: { routeGroupId: routeGroup.id },
  });

  await prisma.routeGroup.update({
    where: { id: routeGroup.id },
    data: { houseCount: count },
  });

  console.log(`Assigned booking ${booking.jobNumber} to route group ${routeGroup.id}`);
}

export async function handleOptimizeRoutes(data: OptimizeRoutesData) {
  const { zoneId, date } = data;

  const where: Record<string, unknown> = {};
  if (zoneId) where.zoneId = zoneId;
  if (date) where.date = new Date(date);

  const routeGroups = await prisma.routeGroup.findMany({
    where,
    include: {
      bookings: {
        where: {
          lat: { not: null },
          lng: { not: null },
          status: { in: ["SCHEDULED", "CONFIRMED"] },
        },
      },
    },
  });

  for (const group of routeGroups) {
    if (group.bookings.length < 2) continue;

    const points = group.bookings.map((b) => ({
      id: b.id,
      lat: b.lat!,
      lng: b.lng!,
    }));

    // Re-cluster with 5-mile max radius constraint
    const clusters = dbscan(points, 1.5, 2, 5);

    // For the main cluster (largest), optimize route
    const mainCluster = clusters.reduce((a, b) =>
      a.length >= b.length ? a : b
    );

    const clusterPoints = mainCluster
      .map((id) => points.find((p) => p.id === id)!)
      .filter(Boolean);

    const optimized = optimizeRoute(clusterPoints);

    // Update route order on bookings
    for (let i = 0; i < optimized.order.length; i++) {
      await prisma.booking.update({
        where: { id: optimized.order[i] },
        data: { routeOrder: i },
      });
    }

    await prisma.routeGroup.update({
      where: { id: group.id },
      data: {
        optimizedRoute: optimized as unknown as Prisma.InputJsonValue,
        estimatedDistance: optimized.totalDistance,
        // Rough estimate: 15 min per stop + drive time at 25 mph
        estimatedDuration:
          clusterPoints.length * 15 +
          Math.round((optimized.totalDistance / 25) * 60),
      },
    });

    console.log(
      `Optimized route group ${group.id}: ${clusterPoints.length} stops, ${optimized.totalDistance} miles`
    );
  }
}
