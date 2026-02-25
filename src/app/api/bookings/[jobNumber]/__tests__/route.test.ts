import { describe, it, expect, vi } from "vitest";
import { createRequest } from "@/test/helpers/request";
import {
  createTestZone,
  createTestAvailableDate,
  createTestBooking,
} from "@/test/helpers/db";

vi.mock("@/lib/queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queue")>();
  return {
    ...actual,
    scheduleJob: vi.fn().mockResolvedValue({ _id: "mock-job-id" }),
  };
});

import { GET, PATCH } from "../route";
import { scheduleJob } from "@/lib/queue";

const mockedScheduleJob = vi.mocked(scheduleJob);

function makeParams(jobNumber: string) {
  return { params: Promise.resolve({ jobNumber }) };
}

describe("GET /api/bookings/[jobNumber]", () => {
  it("returns 404 for non-existent booking", async () => {
    const req = createRequest("/api/bookings/SB-2026-XXXX");
    const res = await GET(req, makeParams("SB-2026-XXXX"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with enriched booking data", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);
    const booking = await createTestBooking({
      zoneId: zone._id,
      availableDateId: avDate._id,
    });

    const req = createRequest(`/api/bookings/${booking.jobNumber}`);
    const res = await GET(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobNumber).toBe(booking.jobNumber);
    expect(body.customerName).toBe("John Doe");
    expect(body.zoneName).toBe("Tri-Cities");
    expect(body.scheduledDate).toBeDefined();
  });

  it("returns null enrichment fields when no zone or available date", async () => {
    const booking = await createTestBooking();

    const req = createRequest(`/api/bookings/${booking.jobNumber}`);
    const res = await GET(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobNumber).toBe(booking.jobNumber);
    expect(body.zoneName).toBeUndefined();
    expect(body.scheduledDate).toBeUndefined();
    expect(body.scheduledTime).toBeUndefined();
  });

  it("handles orphaned zoneId gracefully", async () => {
    const { ObjectId } = await import("mongodb");
    const orphanedZoneId = new ObjectId();
    const booking = await createTestBooking({ zoneId: orphanedZoneId });

    const req = createRequest(`/api/bookings/${booking.jobNumber}`);
    const res = await GET(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobNumber).toBe(booking.jobNumber);
    expect(body.zoneName).toBeUndefined();
  });

  it("handles orphaned availableDateId gracefully", async () => {
    const { ObjectId } = await import("mongodb");
    const orphanedDateId = new ObjectId();
    const booking = await createTestBooking({ availableDateId: orphanedDateId });

    const req = createRequest(`/api/bookings/${booking.jobNumber}`);
    const res = await GET(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobNumber).toBe(booking.jobNumber);
    expect(body.scheduledDate).toBeUndefined();
    expect(body.scheduledTime).toBeUndefined();
  });

  it("returns all expected fields in the response", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id);
    const booking = await createTestBooking({
      zoneId: zone._id,
      availableDateId: avDate._id,
      notes: "Gate code: 1234",
    });

    const req = createRequest(`/api/bookings/${booking.jobNumber}`);
    const res = await GET(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual(
      expect.objectContaining({
        jobNumber: booking.jobNumber,
        serviceType: "SPRINKLER_BLOWOUT",
        customerName: "John Doe",
        customerEmail: "jo**@example.com",
        customerPhone: "50****1234",
        address: "123 Main St",
        city: "Richland",
        state: "WA",
        zip: "99352",
        preferredTime: "MORNING",
        status: "PENDING",
        notes: "Gate code: 1234",
        zoneName: "Tri-Cities",
      })
    );
    expect(body.scheduledDate).toBeDefined();
    expect(body.scheduledTime).toBe("MORNING");
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });
});

describe("PATCH /api/bookings/[jobNumber]", () => {
  it("updates customer fields", async () => {
    const booking = await createTestBooking();
    const req = createRequest(`/api/bookings/${booking.jobNumber}`, {
      method: "PATCH",
      body: { customerName: "Jane Smith" },
    });
    const res = await PATCH(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobNumber).toBe(booking.jobNumber);
  });

  it("cancels a booking and clears route data", async () => {
    mockedScheduleJob.mockClear();
    const zone = await createTestZone();
    const booking = await createTestBooking({
      zoneId: zone._id,
      status: "SCHEDULED",
      routeGroupId: zone._id, // reuse as dummy
      routeOrder: 3,
    });

    const req = createRequest(`/api/bookings/${booking.jobNumber}`, {
      method: "PATCH",
      body: { status: "CANCELLED" },
    });
    const res = await PATCH(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CANCELLED");

    // Should queue cancellation email
    expect(mockedScheduleJob).toHaveBeenCalledWith(
      "send-email",
      expect.objectContaining({ emailType: "CANCELLATION" })
    );
  });

  it("reschedules booking and queues jobs", async () => {
    mockedScheduleJob.mockClear();
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      maxBookings: 20,
    });
    const booking = await createTestBooking({ status: "PENDING" });

    const req = createRequest(`/api/bookings/${booking.jobNumber}`, {
      method: "PATCH",
      body: { availableDateId: avDate._id.toHexString() },
    });
    const res = await PATCH(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("SCHEDULED");

    // Should queue assignment + confirmation
    expect(mockedScheduleJob).toHaveBeenCalledWith(
      "assign-route-group",
      expect.objectContaining({ bookingId: expect.any(String) })
    );
    expect(mockedScheduleJob).toHaveBeenCalledWith(
      "send-email",
      expect.objectContaining({ emailType: "CONFIRMATION" })
    );
  });

  it("returns 400 for COMPLETED bookings", async () => {
    const booking = await createTestBooking({ status: "COMPLETED" });
    const req = createRequest(`/api/bookings/${booking.jobNumber}`, {
      method: "PATCH",
      body: { customerName: "Updated" },
    });
    const res = await PATCH(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("in progress or completed");
  });

  it("returns 400 for IN_PROGRESS bookings", async () => {
    const booking = await createTestBooking({ status: "IN_PROGRESS" });
    const req = createRequest(`/api/bookings/${booking.jobNumber}`, {
      method: "PATCH",
      body: { customerName: "Updated" },
    });
    const res = await PATCH(req, makeParams(booking.jobNumber));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent booking", async () => {
    const req = createRequest("/api/bookings/SB-2026-ZZZZ", {
      method: "PATCH",
      body: { customerName: "Nobody" },
    });
    const res = await PATCH(req, makeParams("SB-2026-ZZZZ"));
    expect(res.status).toBe(404);
  });
});
