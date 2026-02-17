import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { generateTestToken, generateOperatorToken } from "@/test/helpers/auth";
import { createTestZone, createTestAvailableDate, createTestBooking } from "@/test/helpers/db";
import { getDb } from "@/lib/mongodb";
import { GET, POST, PATCH, DELETE } from "../route";

describe("GET /api/admin/zones", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/zones");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("lists zones with counts", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    await createTestAvailableDate(zone._id);
    await createTestBooking({ zoneId: zone._id });

    const req = createRequest("/api/admin/zones", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe("Tri-Cities");
    expect(body[0]._count.bookings).toBe(1);
    expect(body[0]._count.availableDates).toBe(1);
  });
});

describe("POST /api/admin/zones", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/zones", {
      method: "POST",
      body: { name: "Zone", centerLat: 46, centerLng: -119 },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates zone with defaults", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/zones", {
      method: "POST",
      body: { name: "New Zone", centerLat: 46.5, centerLng: -119.5 },
      cookies: { admin_token: token },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("New Zone");
    expect(body.radiusMi).toBe(15);
    expect(body.isActive).toBe(true);
    expect(body.id).toBeDefined();
  });

  it("returns 400 for invalid data", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/zones", {
      method: "POST",
      body: { name: "Z" }, // too short
      cookies: { admin_token: token },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/zones", () => {
  it("updates zone fields", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();

    const req = createRequest("/api/admin/zones", {
      method: "PATCH",
      body: { id: zone._id.toHexString(), name: "Updated Zone" },
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated Zone");
  });

  it("returns 400 without id", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/zones", {
      method: "PATCH",
      body: { name: "No ID" },
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent zone", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/zones", {
      method: "PATCH",
      body: { id: "507f1f77bcf86cd799439011", name: "Ghost" },
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/zones", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/zones?id=xxx", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for OPERATOR role", async () => {
    const token = await generateOperatorToken();
    const req = createRequest("/api/admin/zones?id=507f1f77bcf86cd799439011", {
      method: "DELETE",
      cookies: { admin_token: token },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("cascades delete to available_dates and bookings", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    await createTestAvailableDate(zone._id);
    await createTestBooking({ zoneId: zone._id });

    const req = createRequest(
      `/api/admin/zones?id=${zone._id.toHexString()}`,
      {
        method: "DELETE",
        cookies: { admin_token: token },
      }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    // Verify cascade
    const db = await getDb();
    const dates = await db.collection("available_dates").countDocuments({ zoneId: zone._id });
    expect(dates).toBe(0);

    const booking = await db.collection("bookings").findOne({ zoneId: zone._id });
    // Bookings zoneId should be set to null
    expect(booking).toBeNull();
  });
});
