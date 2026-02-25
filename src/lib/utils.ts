import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateJobNumber(prefix = "SB"): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${year}-${code}`;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

import type { Db } from "mongodb";
import type { ServiceZone } from "./types";

/**
 * Finds the nearest active service zone within radius for the given coordinates.
 */
export async function findNearestZone(
  db: Db,
  lat: number,
  lng: number
): Promise<{ zone: ServiceZone; distance: number } | null> {
  const zones = await db.collection<ServiceZone>("service_zones")
    .find({ isActive: true })
    .toArray();

  let nearestZone: ServiceZone | null = null;
  let nearestDistance = Infinity;

  for (const zone of zones) {
    const dist = haversineDistance(lat, lng, zone.centerLat, zone.centerLng);
    if (dist <= zone.radiusMi && dist < nearestDistance) {
      nearestZone = zone;
      nearestDistance = dist;
    }
  }

  return nearestZone ? { zone: nearestZone, distance: nearestDistance } : null;
}
