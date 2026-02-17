import { describe, it, expect, vi } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { createTestZone } from "@/test/helpers/db";

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(),
}));

import { POST } from "../route";
import { geocodeAddress } from "@/lib/geocode";

const mockedGeocode = vi.mocked(geocodeAddress);

describe("POST /api/validate-address", () => {
  it("returns 400 for invalid input", async () => {
    const req = createRequest("/api/validate-address", {
      method: "POST",
      body: { address: "" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns valid:false when geocode fails", async () => {
    mockedGeocode.mockResolvedValueOnce(null);

    const req = createRequest("/api/validate-address", {
      method: "POST",
      body: {
        address: "123 Main St",
        city: "Richland",
        state: "WA",
        zip: "99352",
      },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it("returns isInServiceArea:true when address is within zone", async () => {
    const zone = await createTestZone();
    mockedGeocode.mockResolvedValueOnce({
      lat: 46.2856,
      lng: -119.2845,
      source: "census",
    });

    const req = createRequest("/api/validate-address", {
      method: "POST",
      body: {
        address: "123 Main St",
        city: "Richland",
        state: "WA",
        zip: "99352",
      },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.isInServiceArea).toBe(true);
    expect(body.zoneId).toBe(zone._id.toHexString());
  });

  it("returns isInServiceArea:false when address is outside zone", async () => {
    await createTestZone();
    mockedGeocode.mockResolvedValueOnce({
      lat: 47.6,
      lng: -122.3, // Seattle - far from Tri-Cities
      source: "census",
    });

    const req = createRequest("/api/validate-address", {
      method: "POST",
      body: {
        address: "456 Pike St",
        city: "Seattle",
        state: "WA",
        zip: "98101",
      },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.isInServiceArea).toBe(false);
    expect(body.zoneId).toBeNull();
  });
});
