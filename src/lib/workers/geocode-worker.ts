import PgBoss from "pg-boss";
import { prisma } from "../prisma";
import { geocodeAddress } from "../geocode";
import { haversineDistance } from "../utils";
import { JOBS } from "../queue";

interface GeocodeJobData {
  bookingId: string;
}

export function registerGeocodeWorker(boss: PgBoss) {
  boss.work<GeocodeJobData>(JOBS.GEOCODE_ADDRESS, async (job) => {
    const { bookingId } = job.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
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
    const zones = await prisma.serviceZone.findMany({
      where: { isActive: true },
    });

    let nearestZone: (typeof zones)[0] | null = null;
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
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        lat: result.lat,
        lng: result.lng,
        zoneId: nearestZone?.id ?? null,
        status: nearestZone ? "AWAITING_SCHEDULE" : "PENDING",
      },
    });

    console.log(
      `Geocoded booking ${booking.jobNumber}: (${result.lat}, ${result.lng})` +
        (nearestZone ? ` -> zone ${nearestZone.name}` : " (no matching zone)")
    );
  });
}
