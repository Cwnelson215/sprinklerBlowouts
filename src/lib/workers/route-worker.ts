import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { dbscan } from "../clustering";
import { optimizeRoute } from "../route-optimizer";
import { Booking, RouteGroup, AvailableDate } from "../types";

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
  const db = await getDb();

  const booking = await db.collection<Booking>("bookings").findOne({
    _id: new ObjectId(bookingId),
  });

  if (!booking) {
    console.error(`Cannot assign route group for booking ${bookingId}: not found`);
    return;
  }

  let availableDate: AvailableDate | null = null;
  if (booking.availableDateId) {
    availableDate = await db.collection<AvailableDate>("available_dates").findOne({
      _id: booking.availableDateId,
    });
  }

  if (!availableDate || !booking.zoneId || !booking.lat || !booking.lng) {
    console.error(`Cannot assign route group for booking ${bookingId}: missing data`);
    return;
  }

  // Find or create a route group for this zone/date/time
  let routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
    zoneId: booking.zoneId,
    date: availableDate.date,
    timeOfDay: availableDate.timeOfDay,
  });

  if (!routeGroup) {
    const now = new Date();
    const result = await db.collection("route_groups").insertOne({
      zoneId: booking.zoneId,
      date: availableDate.date,
      timeOfDay: availableDate.timeOfDay,
      houseCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
      _id: result.insertedId,
    });
  }

  if (!routeGroup) {
    console.error(`Failed to create route group for booking ${bookingId}`);
    return;
  }

  await db.collection<Booking>("bookings").updateOne(
    { _id: new ObjectId(bookingId) },
    {
      $set: {
        routeGroupId: routeGroup._id,
        status: "SCHEDULED",
        updatedAt: new Date(),
      },
    }
  );

  // Update house count
  const count = await db.collection<Booking>("bookings").countDocuments({
    routeGroupId: routeGroup._id,
  });

  await db.collection<RouteGroup>("route_groups").updateOne(
    { _id: routeGroup._id },
    { $set: { houseCount: count, updatedAt: new Date() } }
  );

  console.log(`Assigned booking ${booking.jobNumber} to route group ${routeGroup._id}`);
}

export async function handleOptimizeRoutes(data: OptimizeRoutesData) {
  const { zoneId, date } = data;
  const db = await getDb();

  const query: Record<string, unknown> = {};
  if (zoneId) query.zoneId = new ObjectId(zoneId);
  if (date) query.date = new Date(date);

  const routeGroups = await db.collection<RouteGroup>("route_groups")
    .find(query)
    .toArray();

  for (const group of routeGroups) {
    const bookings = await db.collection<Booking>("bookings")
      .find({
        routeGroupId: group._id,
        lat: { $ne: null },
        lng: { $ne: null },
        status: { $in: ["SCHEDULED", "CONFIRMED"] },
      })
      .toArray();

    if (bookings.length < 2) continue;

    const points = bookings.map((b) => ({
      id: b._id.toHexString(),
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
      await db.collection<Booking>("bookings").updateOne(
        { _id: new ObjectId(optimized.order[i]) },
        { $set: { routeOrder: i, updatedAt: new Date() } }
      );
    }

    await db.collection<RouteGroup>("route_groups").updateOne(
      { _id: group._id },
      {
        $set: {
          optimizedRoute: optimized,
          estimatedDistance: optimized.totalDistance,
          // Rough estimate: 15 min per stop + drive time at 25 mph
          estimatedDuration:
            clusterPoints.length * 15 +
            Math.round((optimized.totalDistance / 25) * 60),
          updatedAt: new Date(),
        },
      }
    );

    console.log(
      `Optimized route group ${group._id}: ${clusterPoints.length} stops, ${optimized.totalDistance} miles`
    );
  }
}
