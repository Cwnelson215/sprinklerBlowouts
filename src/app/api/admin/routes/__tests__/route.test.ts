import { describe, it, expect, vi } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { generateTestToken } from "@/test/helpers/auth";
import {
  createTestZone,
  createTestRouteGroup,
  createTestBooking,
} from "@/test/helpers/db";

vi.mock("@/lib/queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queue")>();
  return {
    ...actual,
    scheduleJob: vi.fn().mockResolvedValue({ _id: "mock-job-id" }),
  };
});

import { GET, POST } from "../route";
import { scheduleJob } from "@/lib/queue";

const mockedScheduleJob = vi.mocked(scheduleJob);

describe("GET /api/admin/routes", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/routes");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("lists routes with zone and booking enrichment", async () => {
    const token = await generateTestToken();
    const zone = await createTestZone();
    const routeGroup = await createTestRouteGroup(zone._id);
    await createTestBooking({
      routeGroupId: routeGroup._id,
      routeOrder: 1,
      zoneId: zone._id,
    });

    const req = createRequest("/api/admin/routes", {
      cookies: { admin_token: token },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].zone).toEqual({ name: "Tri-Cities" });
    expect(body[0].bookings.length).toBe(1);
    expect(body[0].bookings[0].routeOrder).toBe(1);
  });

  it("filters by zoneId", async () => {
    const token = await generateTestToken();
    const zone1 = await createTestZone({ name: "Zone A" });
    const zone2 = await createTestZone({ name: "Zone B" });
    await createTestRouteGroup(zone1._id);
    await createTestRouteGroup(zone2._id);

    const req = createRequest(
      `/api/admin/routes?zoneId=${zone1._id.toHexString()}`,
      { cookies: { admin_token: token } }
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].zone.name).toBe("Zone A");
  });
});

describe("POST /api/admin/routes", () => {
  it("returns 401 without auth", async () => {
    const req = createRequest("/api/admin/routes", {
      method: "POST",
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("queues OPTIMIZE_ROUTES job", async () => {
    mockedScheduleJob.mockClear();
    const token = await generateTestToken();

    const req = createRequest("/api/admin/routes", {
      method: "POST",
      body: { zoneId: "507f1f77bcf86cd799439011" },
      cookies: { admin_token: token },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("queued");
    expect(mockedScheduleJob).toHaveBeenCalledWith(
      "optimize-routes",
      expect.objectContaining({ zoneId: "507f1f77bcf86cd799439011" })
    );
  });
});
