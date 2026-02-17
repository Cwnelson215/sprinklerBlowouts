import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { createTestZone, createTestAvailableDate, createTestBooking } from "@/test/helpers/db";
import { GET } from "../route";

describe("GET /api/availability", () => {
  it("returns 404 when no zone found", async () => {
    const req = createRequest("/api/availability?lat=47.6&lng=-122.3");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns dates with spotsRemaining for a valid zone", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
    });

    const req = createRequest(
      `/api/availability?zoneId=${zone._id.toHexString()}`
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zoneId).toBe(zone._id.toHexString());
    expect(body.dates.length).toBeGreaterThanOrEqual(1);
    expect(body.dates[0].spotsRemaining).toBe(20);
  });

  it("filters by timeOfDay", async () => {
    const zone = await createTestZone();
    await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "MORNING",
    });
    await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      timeOfDay: "AFTERNOON",
    });

    const req = createRequest(
      `/api/availability?zoneId=${zone._id.toHexString()}&timeOfDay=MORNING`
    );
    const res = await GET(req);
    const body = await res.json();
    for (const d of body.dates) {
      expect(d.timeOfDay).toBe("MORNING");
    }
  });

  it("excludes full dates", async () => {
    const zone = await createTestZone();
    const avDate = await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
      maxBookings: 1,
    });

    // Fill the date
    await createTestBooking({
      availableDateId: avDate._id,
      zoneId: zone._id,
    });

    const req = createRequest(
      `/api/availability?zoneId=${zone._id.toHexString()}`
    );
    const res = await GET(req);
    const body = await res.json();
    const fullDate = body.dates.find(
      (d: { id: string }) => d.id === avDate._id.toHexString()
    );
    expect(fullDate).toBeUndefined();
  });

  it("finds zone by lat/lng coordinates", async () => {
    const zone = await createTestZone();
    await createTestAvailableDate(zone._id, {
      date: new Date("2027-10-15T00:00:00.000Z"),
    });

    const req = createRequest("/api/availability?lat=46.2856&lng=-119.2845");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zoneId).toBe(zone._id.toHexString());
  });
});
