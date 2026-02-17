import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { generateTestToken } from "@/test/helpers/auth";
import { createTestZone, createTestAvailableDate, createTestBooking } from "@/test/helpers/db";
import { getDb } from "@/lib/mongodb";
import { GET, POST, PATCH, DELETE } from "../route";

describe("GET /api/admin/availability", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/availability");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("lists availability dates with enrichment", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);
    await createTestBooking({
      availableDateId: avDate._id,
      bookedTime: "08:00",
      status: "SCHEDULED",
    });

    const req = createRequest("/api/admin/availability", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].zone).toEqual({ name: "Tri-Cities" });
    expect(body[0]._count.bookings).toBe(1);
    expect(body[0].bookedTimes).toContain("08:00");
    expect(body[0].allTimeSlots.length).toBeGreaterThan(0);
  });

  it("filters by zoneId", async () => {
    const token = await generateTestToken();
    const zone1 = await createTestZone({ name: "Zone A" });
    const zone2 = await createTestZone({ name: "Zone B" });
    await createTestAvailableDate(zone1._id);
    await createTestAvailableDate(zone2._id);

    const req = createRequest(
      `/api/admin/availability?zoneId=${zone1._id.toHexString()}`,
      { cookies: { admin_token: token } }
    );
    const res = await GET(req);
    const body = await res.json();
    for (const d of body) {
      expect(d.zoneId).toBe(zone1._id.toHexString());
    }
  });
});

describe("POST /api/admin/availability", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/availability", {
      method: "POST",
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates availability date", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();

    const req = createRequest("/api/admin/availability", {
      method: "POST",
      body: {
        zoneId: zone._id.toHexString(),
        date: "2027-10-15",
        timeOfDay: "MORNING",
        serviceType: "SPRINKLER_BLOWOUT",
      },
      cookies: { admin_token: token },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.timeOfDay).toBe("MORNING");
    expect(body.maxBookings).toBe(20);
    expect(body.id).toBeDefined();
  });

  it("returns 400 for invalid data", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/availability", {
      method: "POST",
      body: { zoneId: "x", date: "invalid" },
      cookies: { admin_token: token },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/availability", () => {
  it("updates maxBookings", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);

    const req = createRequest(
      `/api/admin/availability?id=${avDate._id.toHexString()}`,
      {
        method: "PATCH",
        body: { maxBookings: 30 },
        cookies: { admin_token: token },
      }
    );
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.maxBookings).toBe(30);
  });

  it("updates disabledTimes", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);

    const req = createRequest(
      `/api/admin/availability?id=${avDate._id.toHexString()}`,
      {
        method: "PATCH",
        body: { disabledTimes: ["08:00", "09:30"] },
        cookies: { admin_token: token },
      }
    );
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disabledTimes).toEqual(["08:00", "09:30"]);
  });

  it("returns 400 when no id provided", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/availability", {
      method: "PATCH",
      body: { maxBookings: 30 },
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent date", async () => {
    const token = await generateTestToken();
    const req = createRequest(
      "/api/admin/availability?id=507f1f77bcf86cd799439011",
      {
        method: "PATCH",
        body: { maxBookings: 30 },
        cookies: { admin_token: token },
      }
    );
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/availability", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/availability?id=xxx", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("sets affected bookings to AWAITING_SCHEDULE", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);
    const booking = await createTestBooking({
      availableDateId: avDate._id,
      status: "SCHEDULED",
    });

    const req = createRequest(
      `/api/admin/availability?id=${avDate._id.toHexString()}`,
      {
        method: "DELETE",
        cookies: { admin_token: token },
      }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    // Verify booking was updated
    const db = await getDb();
    const updatedBooking = await db.collection("bookings").findOne({
      _id: booking._id,
    });
    expect(updatedBooking!.status).toBe("AWAITING_SCHEDULE");
    expect(updatedBooking!.availableDateId).toBeNull();
  });
});
