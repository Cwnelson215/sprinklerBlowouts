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

  // Find or create a route group for this zone/date (combine all time slots)
  let routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
    zoneId: booking.zoneId,
    date: availableDate.date,
  });

  if (!routeGroup) {
    const now = new Date();
    const result = await db.collection("route_groups").insertOne({
      zoneId: booking.zoneId,
      date: availableDate.date,
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

  // First, create route groups for any scheduled bookings that don't have one
  const bookingQuery: Record<string, unknown> = {
    status: { $in: ["SCHEDULED", "CONFIRMED"] },
    availableDateId: { $ne: null },
    zoneId: { $ne: null },
    lat: { $ne: null },
    lng: { $ne: null },
    routeGroupId: null,
  };
  if (zoneId) bookingQuery.zoneId = new ObjectId(zoneId);

  const unassignedBookings = await db.collection<Booking>("bookings")
    .find(bookingQuery)
    .toArray();

  console.log(`Found ${unassignedBookings.length} scheduled bookings without route groups`);

  for (const booking of unassignedBookings) {
    if (!booking.availableDateId || !booking.zoneId) continue;

    const availableDate = await db.collection<AvailableDate>("available_dates").findOne({
      _id: booking.availableDateId,
    });

    if (!availableDate) continue;

    // Skip if date filter is set and doesn't match
    if (date && availableDate.date.toISOString() !== new Date(date).toISOString()) continue;

    // Find or create route group for this zone/date
    let routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
      zoneId: booking.zoneId,
      date: availableDate.date,
    });

    if (!routeGroup) {
      const now = new Date();
      const result = await db.collection("route_groups").insertOne({
        zoneId: booking.zoneId,
        date: availableDate.date,
        houseCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
        _id: result.insertedId,
      });
      console.log(`Created route group for zone ${booking.zoneId} on ${availableDate.date}`);
    }

    if (routeGroup) {
      await db.collection<Booking>("bookings").updateOne(
        { _id: booking._id },
        { $set: { routeGroupId: routeGroup._id, updatedAt: new Date() } }
      );
      console.log(`Assigned booking ${booking.jobNumber} to route group ${routeGroup._id}`);
    }
  }

  // Update house counts for all route groups
  const allRouteGroups = await db.collection<RouteGroup>("route_groups").find({}).toArray();
  for (const group of allRouteGroups) {
    const count = await db.collection<Booking>("bookings").countDocuments({
      routeGroupId: group._id,
    });
    await db.collection<RouteGroup>("route_groups").updateOne(
      { _id: group._id },
      { $set: { houseCount: count, updatedAt: new Date() } }
    );
  }

  // Now proceed with route optimization
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

    if (bookings.length === 0) continue;

    if (bookings.length === 1) {
      // Single booking - set order, no optimization needed
      await db.collection<Booking>("bookings").updateOne(
        { _id: bookings[0]._id },
        { $set: { routeOrder: 0, updatedAt: new Date() } }
      );

      await db.collection<RouteGroup>("route_groups").updateOne(
        { _id: group._id },
        {
          $set: {
            optimizedRoute: { order: [bookings[0]._id.toHexString()], totalDistance: 0 },
            estimatedDistance: 0,
            estimatedDuration: 15,
            updatedAt: new Date(),
          },
        }
      );

      console.log(`Set route for single-booking group ${group._id}`);
      continue;
    }

    const points = bookings.map((b) => ({
      id: b._id.toHexString(),
      lat: b.lat!,
      lng: b.lng!,
    }));

    // Re-cluster with 0.5-mile max radius constraint
    const clusters = dbscan(points, 0.5, 2, 0.5);

    // Build a list of (routeGroupId, clusterPoints) pairs to optimize
    const clustersToOptimize: { routeGroupId: ObjectId; clusterPoints: typeof points }[] = [];

    // First cluster stays on the existing route group
    const firstClusterPoints = clusters[0]
      .map((id) => points.find((p) => p.id === id)!)
      .filter(Boolean);
    clustersToOptimize.push({ routeGroupId: group._id, clusterPoints: firstClusterPoints });

    // Additional clusters each get a new route group
    for (let c = 1; c < clusters.length; c++) {
      const extraPoints = clusters[c]
        .map((id) => points.find((p) => p.id === id)!)
        .filter(Boolean);

      if (extraPoints.length === 0) continue;

      const now = new Date();
      const result = await db.collection("route_groups").insertOne({
        zoneId: group.zoneId,
        date: group.date,
        houseCount: extraPoints.length,
        createdAt: now,
        updatedAt: now,
      });

      // Reassign bookings in this cluster to the new route group
      const extraIds = extraPoints.map((p) => new ObjectId(p.id));
      await db.collection<Booking>("bookings").updateMany(
        { _id: { $in: extraIds } },
        { $set: { routeGroupId: result.insertedId, updatedAt: new Date() } }
      );

      clustersToOptimize.push({ routeGroupId: result.insertedId, clusterPoints: extraPoints });
      console.log(`Created new route group ${result.insertedId} for cluster with ${extraPoints.length} stops`);
    }

    // Optimize each cluster independently
    for (const { routeGroupId, clusterPoints } of clustersToOptimize) {
      if (clusterPoints.length === 0) continue;

      if (clusterPoints.length === 1) {
        await db.collection<Booking>("bookings").updateOne(
          { _id: new ObjectId(clusterPoints[0].id) },
          { $set: { routeOrder: 0, updatedAt: new Date() } }
        );
        await db.collection<RouteGroup>("route_groups").updateOne(
          { _id: routeGroupId },
          {
            $set: {
              optimizedRoute: { order: [clusterPoints[0].id], totalDistance: 0 },
              estimatedDistance: 0,
              estimatedDuration: 15,
              houseCount: 1,
              updatedAt: new Date(),
            },
          }
        );
        console.log(`Set route for single-stop cluster in group ${routeGroupId}`);
        continue;
      }

      const optimized = optimizeRoute(clusterPoints);

      // Update route order on bookings
      for (let i = 0; i < optimized.order.length; i++) {
        await db.collection<Booking>("bookings").updateOne(
          { _id: new ObjectId(optimized.order[i]) },
          { $set: { routeOrder: i, updatedAt: new Date() } }
        );
      }

      await db.collection<RouteGroup>("route_groups").updateOne(
        { _id: routeGroupId },
        {
          $set: {
            optimizedRoute: optimized,
            estimatedDistance: optimized.totalDistance,
            // Rough estimate: 15 min per stop + drive time at 25 mph
            estimatedDuration:
              clusterPoints.length * 15 +
              Math.round((optimized.totalDistance / 25) * 60),
            houseCount: clusterPoints.length,
            updatedAt: new Date(),
          },
        }
      );

      console.log(
        `Optimized route group ${routeGroupId}: ${clusterPoints.length} stops, ${optimized.totalDistance} miles`
      );
    }

    // Update house count on the original group (may have shrunk if clusters split off)
    const remainingCount = await db.collection<Booking>("bookings").countDocuments({
      routeGroupId: group._id,
    });
    await db.collection<RouteGroup>("route_groups").updateOne(
      { _id: group._id },
      { $set: { houseCount: remainingCount, updatedAt: new Date() } }
    );
  }
}
