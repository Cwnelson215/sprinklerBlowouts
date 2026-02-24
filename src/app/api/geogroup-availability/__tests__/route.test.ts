import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { createTestZone, createTestAvailableDate, createTestBooking } from "@/test/helpers/db";
import { GET } from "../route";

describe("GET /api/geogroup-availability", () => {
  it("returns 400 for missing zoneId", async () => {
    const req = createRequest("/api/geogroup-availability?timeOfDay=MORNING&serviceType=SPRINKLER_BLOWOUT");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing timeOfDay", async () => {
    const req = createRequest("/api/geogroup-availability?zoneId=507f1f77bcf86cd799439011&serviceType=SPRINKLER_BLOWOUT");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing serviceType", async () => {
    const req = createRequest("/api/geogroup-availability?zoneId=507f1f77bcf86cd799439011&timeOfDay=MORNING");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for invalid zone", async () => {
    const req = createRequest(
      "/api/geogroup-availability?zoneId=507f1f77bcf86cd799439011&timeOfDay=MORNING&serviceType=SPRINKLER_BLOWOUT"
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("first-in-zone: shows all valid dates", async () => {
    const zone = await createTestZone();
    // Wednesday Oct 14, 2026
    await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-14T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    const req = createRequest(
      `/api/geogroup-availability?zoneId=${zone._id.toHexString()}&timeOfDay=AFTERNOON&serviceType=SPRINKLER_BLOWOUT`
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFirstInZone).toBe(true);
    expect(body.availableDates.length).toBeGreaterThanOrEqual(1);
    // Each date should have availableTimes
    for (const d of body.availableDates) {
      expect(d.availableTimes.length).toBeGreaterThan(0);
    }
  });

  it("first-in-zone: blocks Sunday", async () => {
    const zone = await createTestZone();
    // Sunday Oct 18, 2026
    await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-18T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    const req = createRequest(
      `/api/geogroup-availability?zoneId=${zone._id.toHexString()}&timeOfDay=AFTERNOON&serviceType=SPRINKLER_BLOWOUT`
    );
    const res = await GET(req);
    const body = await res.json();
    // Sunday should be filtered out
    const sundayDate = body.availableDates.find(
      (d: { date: string }) => d.date === "2026-10-18"
    );
    expect(sundayDate).toBeUndefined();
  });

  it("first-in-zone: Saturday only allows MORNING", async () => {
    const zone = await createTestZone();
    // Saturday Oct 17, 2026
    await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-17T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });
    await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-17T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    // Check MORNING on Saturday - should be allowed
    const morningReq = createRequest(
      `/api/geogroup-availability?zoneId=${zone._id.toHexString()}&timeOfDay=MORNING&serviceType=SPRINKLER_BLOWOUT`
    );
    const morningRes = await GET(morningReq);
    const morningBody = await morningRes.json();
    const satMorning = morningBody.availableDates.find(
      (d: { date: string }) => d.date === "2026-10-17"
    );
    expect(satMorning).toBeDefined();
  });

  it("subsequent bookings: only shows dates with existing bookings", async () => {
    const zone = await createTestZone();
    const avDate1 = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });
    const avDate2 = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-16T00:00:00.000Z"),
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    // Create a scheduled booking on avDate1 only
    await createTestBooking({
      zoneId: zone._id,
      availableDateId: avDate1._id,
      preferredTime: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
      status: "SCHEDULED",
      bookedTime: "08:00",
    });

    const req = createRequest(
      `/api/geogroup-availability?zoneId=${zone._id.toHexString()}&timeOfDay=MORNING&serviceType=SPRINKLER_BLOWOUT`
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.isFirstInZone).toBe(false);
    // Only avDate1 should be shown since it has an existing booking
    const dateIds = body.availableDates.map((d: { id: string }) => d.id);
    expect(dateIds).toContain(avDate1._id.toHexString());
    expect(dateIds).not.toContain(avDate2._id.toHexString());
  });

  it("subsequent bookings: falls back to all dates when geo-grouped dates are fully booked", async () => {
    const zone = await createTestZone();

    // Wednesday Oct 14, 2026 — geo-grouped date (will be fully booked)
    const fullyBookedDate = await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-14T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    // Thursday Oct 15, 2026 — fallback date (has open slots)
    const fallbackDate = await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-15T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
    });

    // Book all 5 AFTERNOON slots on the geo-grouped date (12:00, 12:45, 13:30, 14:15, 15:00)
    const allAfternoonTimes = ["12:00", "12:45", "13:30", "14:15", "15:00"];
    for (const time of allAfternoonTimes) {
      await createTestBooking({
        zoneId: zone._id,
        availableDateId: fullyBookedDate._id,
        preferredTime: "AFTERNOON",
        serviceType: "SPRINKLER_BLOWOUT",
        status: "SCHEDULED",
        bookedTime: time,
      });
    }

    const req = createRequest(
      `/api/geogroup-availability?zoneId=${zone._id.toHexString()}&timeOfDay=AFTERNOON&serviceType=SPRINKLER_BLOWOUT`
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.isFirstInZone).toBe(false);
    // The fully booked date should NOT appear (no available times)
    const bookedDateEntry = body.availableDates.find(
      (d: { id: string }) => d.id === fullyBookedDate._id.toHexString()
    );
    expect(bookedDateEntry).toBeUndefined();
    // The fallback date SHOULD appear (has open slots)
    const fallbackEntry = body.availableDates.find(
      (d: { id: string }) => d.id === fallbackDate._id.toHexString()
    );
    expect(fallbackEntry).toBeDefined();
    expect(fallbackEntry.availableTimes.length).toBeGreaterThan(0);
  });

  it("excludes disabled and booked times from available times", async () => {
    const zone = await createTestZone();
    // Wednesday
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2026-10-14T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
      disabledTimes: ["12:00"],
    });

    // Book a time
    await createTestBooking({
      zoneId: zone._id,
      availableDateId: avDate._id,
      preferredTime: "AFTERNOON",
      serviceType: "SPRINKLER_BLOWOUT",
      status: "SCHEDULED",
      bookedTime: "12:45",
    });

    const req = createRequest(
      `/api/geogroup-availability?zoneId=${zone._id.toHexString()}&timeOfDay=AFTERNOON&serviceType=SPRINKLER_BLOWOUT`
    );
    const res = await GET(req);
    const body = await res.json();

    // Since there's a booking, isFirstInZone should be false.
    // But the booking is on this date so it should still appear.
    const dateEntry = body.availableDates.find(
      (d: { id: string }) => d.id === avDate._id.toHexString()
    );
    if (dateEntry) {
      expect(dateEntry.availableTimes).not.toContain("12:00"); // disabled
      expect(dateEntry.availableTimes).not.toContain("12:45"); // booked
    }
  });
});
