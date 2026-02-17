import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { hash } from "bcryptjs";

export async function createTestZone(overrides: Record<string, unknown> = {}) {
  const db = await getDb();
  const now = new Date();
  const doc = {
    name: "Tri-Cities",
    centerLat: 46.2856,
    centerLng: -119.2845,
    radiusMi: 15,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const result = await db.collection("service_zones").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function createTestAvailableDate(
  zoneId: ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const db = await getDb();
  const doc = {
    zoneId,
    date: new Date("2026-10-15T00:00:00.000Z"),
    timeOfDay: "MORNING",
    serviceType: "SPRINKLER_BLOWOUT",
    maxBookings: 20,
    disabledTimes: [] as string[],
    createdAt: new Date(),
    ...overrides,
  };
  const result = await db.collection("available_dates").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function createTestBooking(overrides: Record<string, unknown> = {}) {
  const db = await getDb();
  const now = new Date();
  const doc = {
    jobNumber: `SB-2026-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    serviceType: "SPRINKLER_BLOWOUT",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: "509-555-1234",
    address: "123 Main St",
    city: "Richland",
    state: "WA",
    zip: "99352",
    preferredTime: "MORNING",
    bookedTime: null as string | null,
    status: "PENDING",
    notes: null,
    lat: 46.2856,
    lng: -119.2845,
    zoneId: null as ObjectId | null,
    availableDateId: null as ObjectId | null,
    routeGroupId: null as ObjectId | null,
    routeOrder: null as number | null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const result = await db.collection("bookings").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function createTestAdmin(overrides: Record<string, unknown> = {}) {
  const db = await getDb();
  const now = new Date();
  const passwordHash = await hash("TestPassword123", 4); // low rounds for speed
  const doc = {
    email: "admin@example.com",
    passwordHash,
    role: "SUPER_ADMIN",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const result = await db.collection("admin_users").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function createTestRouteGroup(
  zoneId: ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const db = await getDb();
  const now = new Date();
  const doc = {
    zoneId,
    date: new Date("2026-10-15T00:00:00.000Z"),
    timeOfDay: "MORNING",
    serviceType: "SPRINKLER_BLOWOUT",
    optimizedRoute: null,
    estimatedDuration: null,
    estimatedDistance: null,
    houseCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const result = await db.collection("route_groups").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}
