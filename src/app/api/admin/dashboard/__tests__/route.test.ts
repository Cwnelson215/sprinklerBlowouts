import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { generateTestToken } from "@/test/helpers/auth";
import { createTestZone, createTestBooking, createTestAvailableDate } from "@/test/helpers/db";
import { GET } from "../route";

describe("GET /api/admin/dashboard", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/dashboard");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns correct stat counts", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
    });

    await createTestBooking({ status: "PENDING" });
    await createTestBooking({ status: "SCHEDULED" });
    await createTestBooking({ status: "COMPLETED" });
    await createTestBooking({ status: "CANCELLED" });

    const req = createRequest("/api/admin/dashboard", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.stats.totalBookings).toBe(4);
    expect(body.stats.pendingBookings).toBe(1); // PENDING
    expect(body.stats.scheduledBookings).toBe(1); // SCHEDULED
    expect(body.stats.completedBookings).toBe(1);
    expect(body.stats.cancelledBookings).toBe(1);
    expect(body.stats.activeZones).toBe(1);
    expect(body.stats.upcomingDates).toBe(1);
  });

  it("returns recent bookings", async () => {
    const token = await generateTestToken();
    await createTestBooking({ jobNumber: "SB-2026-REC1" });

    const req = createRequest("/api/admin/dashboard", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.recentBookings.length).toBe(1);
    expect(body.recentBookings[0].jobNumber).toBe("SB-2026-REC1");
  });

  it("returns 30-day booking trend", async () => {
    const token = await generateTestToken();
    await createTestBooking({ createdAt: new Date() });

    const req = createRequest("/api/admin/dashboard", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(Array.isArray(body.bookingsByDay)).toBe(true);
    if (body.bookingsByDay.length > 0) {
      expect(body.bookingsByDay[0]).toHaveProperty("date");
      expect(body.bookingsByDay[0]).toHaveProperty("_count");
    }
  });

  it("returns zeros when empty", async () => {
    const token = await generateTestToken();

    const req = createRequest("/api/admin/dashboard", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.stats.totalBookings).toBe(0);
    expect(body.stats.pendingBookings).toBe(0);
    expect(body.stats.activeZones).toBe(0);
    expect(body.recentBookings).toEqual([]);
    expect(body.bookingsByDay).toEqual([]);
  });
});
