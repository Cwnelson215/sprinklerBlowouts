import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { optimizeRoute } from "../route-optimizer";
import { Booking, RouteGroup, AvailableDate } from "../types";
import { DEPOT } from "../constants";

interface AssignRouteGroupData {
  bookingId: string;
}

interface OptimizeRoutesData {
  zoneId?: string;
  date?: string;
  serviceType?: string;
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

  // Normalize date to midnight UTC for consistent same-day grouping
  const normalizedDate = new Date(Date.UTC(
    availableDate.date.getUTCFullYear(),
    availableDate.date.getUTCMonth(),
    availableDate.date.getUTCDate()
  ));

  // Find or create a route group for this zone/date/serviceType (combine all time slots)
  let routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
    zoneId: booking.zoneId,
    date: normalizedDate,
    serviceType: booking.serviceType,
  });

  if (!routeGroup) {
    const now = new Date();
    const result = await db.collection("route_groups").insertOne({
      zoneId: booking.zoneId,
      date: normalizedDate,
      serviceType: booking.serviceType,
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
  const { zoneId, date, serviceType } = data;
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
  if (serviceType) bookingQuery.serviceType = serviceType;

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

    // Normalize date to midnight UTC for consistent same-day grouping
    const normalizedDate = new Date(Date.UTC(
      availableDate.date.getUTCFullYear(),
      availableDate.date.getUTCMonth(),
      availableDate.date.getUTCDate()
    ));

    // Skip if date filter is set and doesn't match
    if (date) {
      const filterDate = new Date(date);
      const normalizedFilter = new Date(Date.UTC(
        filterDate.getUTCFullYear(),
        filterDate.getUTCMonth(),
        filterDate.getUTCDate()
      ));
      if (normalizedDate.getTime() !== normalizedFilter.getTime()) continue;
    }

    // Find or create route group for this zone/date/serviceType
    let routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
      zoneId: booking.zoneId,
      date: normalizedDate,
      serviceType: booking.serviceType,
    });

    if (!routeGroup) {
      const now = new Date();
      const result = await db.collection("route_groups").insertOne({
        zoneId: booking.zoneId,
        date: normalizedDate,
        serviceType: booking.serviceType,
        houseCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      routeGroup = await db.collection<RouteGroup>("route_groups").findOne({
        _id: result.insertedId,
      });
      console.log(`Created route group for zone ${booking.zoneId} on ${normalizedDate.toISOString()}`);
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
  if (serviceType) query.serviceType = serviceType;

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
      // Single booking - set order, include depot-to-stop distance
      const depot = { lat: DEPOT.lat, lng: DEPOT.lng };
      const singleResult = optimizeRoute(
        [{ id: bookings[0]._id.toHexString(), lat: bookings[0].lat!, lng: bookings[0].lng! }],
        depot
      );

      await db.collection<Booking>("bookings").updateOne(
        { _id: bookings[0]._id },
        { $set: { routeOrder: 0, updatedAt: new Date() } }
      );

      await db.collection<RouteGroup>("route_groups").updateOne(
        { _id: group._id },
        {
          $set: {
            optimizedRoute: singleResult,
            estimatedDistance: singleResult.totalDistance,
            estimatedDuration: 15 + Math.round((singleResult.totalDistance / 25) * 60),
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

    const depot = { lat: DEPOT.lat, lng: DEPOT.lng };
    const optimized = optimizeRoute(points, depot);

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
            bookings.length * 15 +
            Math.round((optimized.totalDistance / 25) * 60),
          houseCount: bookings.length,
          updatedAt: new Date(),
        },
      }
    );

    console.log(
      `Optimized route group ${group._id}: ${bookings.length} stops, ${optimized.totalDistance} miles`
    );
  }
}
