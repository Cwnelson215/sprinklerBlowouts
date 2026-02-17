import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { generateTestToken, generateOperatorToken } from "@/test/helpers/auth";
import { createTestBooking, createTestZone, createTestAvailableDate } from "@/test/helpers/db";
import { GET, PATCH, DELETE } from "../route";

describe("GET /api/admin/bookings", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/bookings");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns paginated bookings", async () => {
    const token = await generateTestToken();
    await createTestBooking({ jobNumber: "SB-2026-AAA1" });
    await createTestBooking({ jobNumber: "SB-2026-AAA2" });
    await createTestBooking({ jobNumber: "SB-2026-AAA3" });

    const req = createRequest("/api/admin/bookings?page=1&limit=2", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings.length).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
  });

  it("filters by status", async () => {
    const token = await generateTestToken();
    await createTestBooking({ status: "PENDING" });
    await createTestBooking({ status: "SCHEDULED" });

    const req = createRequest("/api/admin/bookings?status=PENDING", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    const body = await res.json();
    for (const b of body.bookings) {
      expect(b.status).toBe("PENDING");
    }
  });

  it("filters by search", async () => {
    const token = await generateTestToken();
    await createTestBooking({ customerName: "Alice Special", jobNumber: "SB-2026-ALCE" });
    await createTestBooking({ customerName: "Bob Normal", jobNumber: "SB-2026-BOBN" });

    const req = createRequest("/api/admin/bookings?search=Alice", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.bookings.length).toBe(1);
    expect(body.bookings[0].customerName).toBe("Alice Special");
  });

  it("enriches bookings with zone and date info", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);
    await createTestBooking({
      zoneId: zone._id,
      availableDateId: avDate._id,
    });

    const req = createRequest("/api/admin/bookings", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.bookings[0].zone).toEqual({ name: "Tri-Cities" });
    expect(body.bookings[0].availableDate).toBeDefined();
  });
});

describe("PATCH /api/admin/bookings", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/bookings", {
      method: "PATCH",
      body: { id: "xxx", status: "COMPLETED" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("updates booking status", async () => {
    const token = await generateTestToken();
    const booking = await createTestBooking();

    const req = createRequest("/api/admin/bookings", {
      method: "PATCH",
      body: { id: booking._id.toHexString(), status: "COMPLETED" },
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("COMPLETED");
  });

  it("returns 404 for non-existent booking", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/bookings", {
      method: "PATCH",
      body: { id: "507f1f77bcf86cd799439011", status: "COMPLETED" },
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when id or status missing", async () => {
    const token = await generateTestToken();
    const req = createRequest("/api/admin/bookings", {
      method: "PATCH",
      body: {},
      cookies: { admin_token: token },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/bookings", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/bookings?id=xxx", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for OPERATOR role", async () => {
    const token = await generateOperatorToken();
    const req = createRequest("/api/admin/bookings?id=507f1f77bcf86cd799439011", {
      method: "DELETE",
      cookies: { admin_token: token },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("deletes booking for SUPER_ADMIN", async () => {
    const token = await generateTestToken();
    const booking = await createTestBooking();

    const req = createRequest(
      `/api/admin/bookings?id=${booking._id.toHexString()}`,
      {
        method: "DELETE",
        cookies: { admin_token: token },
      }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
