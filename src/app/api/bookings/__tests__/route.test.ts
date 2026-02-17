import { describe, it, expect, vi } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { createTestZone, createTestAvailableDate, createTestBooking } from "@/test/helpers/db";

vi.mock("@/lib/queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queue")>();
  return {
    ...actual,
    scheduleJob: vi.fn().mockResolvedValue({ _id: "mock-job-id" }),
  };
});

import { POST } from "../route";
import { scheduleJob } from "@/lib/queue";

const mockedScheduleJob = vi.mocked(scheduleJob);

describe("POST /api/bookings", () => {
  const validBooking = {
    serviceType: "SPRINKLER_BLOWOUT",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    address: "123 Main St",
    city: "Richland",
    state: "WA",
    zip: "99352",
    preferredTime: "MORNING",
  };

  it("returns 400 for invalid body", async () => {
    const req = createRequest("/api/bookings", {
      method: "POST",
      body: { customerName: "J" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates booking with 201 and correct job prefix for SPRINKLER_BLOWOUT", async () => {
    const req = createRequest("/api/bookings", {
      method: "POST",
      body: validBooking,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobNumber).toMatch(/^SB-/);
    expect(body.status).toBe("PENDING");
    expect(body.id).toBeDefined();
  });

  it("creates booking with BF prefix for BACKFLOW_TESTING", async () => {
    const req = createRequest("/api/bookings", {
      method: "POST",
      body: { ...validBooking, serviceType: "BACKFLOW_TESTING" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobNumber).toMatch(/^BF-/);
  });

  it("sets SCHEDULED status when availableDateId is provided", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    const req = createRequest("/api/bookings", {
      method: "POST",
      body: {
        ...validBooking,
        availableDateId: avDate._id.toHexString(),
        bookedTime: "08:00",
        lat: 46.2856,
        lng: -119.2845,
        zoneId: zone._id.toHexString(),
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("SCHEDULED");
  });

  it("returns 409 when time slot is already booked", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    // Create existing booking at 08:00
    await createTestBooking({
      availableDateId: avDate._id,
      bookedTime: "08:00",
      status: "SCHEDULED",
    });

    const req = createRequest("/api/bookings", {
      method: "POST",
      body: {
        ...validBooking,
        availableDateId: avDate._id.toHexString(),
        bookedTime: "08:00",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 for disabled time", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
      disabledTimes: ["08:00"],
    });

    const req = createRequest("/api/bookings", {
      method: "POST",
      body: {
        ...validBooking,
        availableDateId: avDate._id.toHexString(),
        bookedTime: "08:00",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("disabled");
  });

  it("returns 400 for nonexistent available date", async () => {
    const req = createRequest("/api/bookings", {
      method: "POST",
      body: {
        ...validBooking,
        availableDateId: "507f1f77bcf86cd799439011",
        bookedTime: "08:00",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("queues GEOCODE_ADDRESS when no geo data provided", async () => {
    mockedScheduleJob.mockClear();
    const req = createRequest("/api/bookings", {
      method: "POST",
      body: validBooking,
    });
    await POST(req);
    expect(mockedScheduleJob).toHaveBeenCalledWith(
      "geocode-address",
      expect.objectContaining({ bookingId: expect.any(String) })
    );
  });

  it("queues ASSIGN_ROUTE_GROUP when geo data and date provided", async () => {
    mockedScheduleJob.mockClear();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    const req = createRequest("/api/bookings", {
      method: "POST",
      body: {
        ...validBooking,
        lat: 46.2856,
        lng: -119.2845,
        zoneId: zone._id.toHexString(),
        availableDateId: avDate._id.toHexString(),
        bookedTime: "08:00",
      },
    });
    await POST(req);
    expect(mockedScheduleJob).toHaveBeenCalledWith(
      "assign-route-group",
      expect.objectContaining({ bookingId: expect.any(String) })
    );
  });
});
