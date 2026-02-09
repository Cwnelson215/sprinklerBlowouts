import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { geocodeAddress } from "../geocode";
import { haversineDistance } from "../utils";
import { Booking, ServiceZone } from "../types";
import { scheduleJob, JOBS } from "../queue";

interface GeocodeJobData {
  bookingId: string;
}

export async function handleGeocodeJob(data: GeocodeJobData) {
  const { bookingId } = data;
  const db = await getDb();

  const booking = await db.collection<Booking>("bookings").findOne({
    _id: new ObjectId(bookingId),
  });

  if (!booking) {
    console.error(`Booking ${bookingId} not found`);
    return;
  }

  // Geocode the address
  const result = await geocodeAddress(
    booking.address,
    booking.city,
    booking.state,
    booking.zip
  );

  if (!result) {
    console.error(`Failed to geocode booking ${bookingId}: ${booking.address}`);
    // Keep as PENDING - admin can manually handle
    return;
  }

  // Find the nearest active zone
  const zones = await db.collection<ServiceZone>("service_zones")
    .find({ isActive: true })
    .toArray();

  let nearestZone: ServiceZone | null = null;
  let nearestDistance = Infinity;

  for (const zone of zones) {
    const dist = haversineDistance(
      result.lat,
      result.lng,
      zone.centerLat,
      zone.centerLng
    );
    if (dist <= zone.radiusMi && dist < nearestDistance) {
      nearestZone = zone;
      nearestDistance = dist;
    }
  }

  // Update booking with geocode results and zone assignment
  await db.collection<Booking>("bookings").updateOne(
    { _id: new ObjectId(bookingId) },
    {
      $set: {
        lat: result.lat,
        lng: result.lng,
        zoneId: nearestZone?._id ?? null,
        status: nearestZone ? "AWAITING_SCHEDULE" : "PENDING",
        updatedAt: new Date(),
      },
    }
  );

  // If booking has a zone and a date, queue route group assignment
  if (nearestZone && booking.availableDateId) {
    try {
      await scheduleJob(JOBS.ASSIGN_ROUTE_GROUP, { bookingId });
    } catch (err) {
      console.error("Failed to queue route assignment after geocode:", err);
    }
  }

  console.log(
    `Geocoded booking ${booking.jobNumber}: (${result.lat}, ${result.lng})` +
      (nearestZone ? ` -> zone ${nearestZone.name}` : " (no matching zone)")
  );
}
