import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeAddress } from "../geocode";

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.OPENCAGE_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns census result on success", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          addressMatches: [
            {
              coordinates: { y: 46.2856, x: -119.2845 },
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await geocodeAddress("123 Main St", "Richland", "WA", "99352");
    expect(result).toEqual({
      lat: 46.2856,
      lng: -119.2845,
      source: "census",
    });
  });

  it("falls back to OpenCage when census fails", async () => {
    process.env.OPENCAGE_API_KEY = "test-key";

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false }) // Census fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              geometry: { lat: 46.29, lng: -119.29 },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await geocodeAddress("123 Main St", "Richland", "WA", "99352");
    expect(result).toEqual({
      lat: 46.29,
      lng: -119.29,
      source: "opencage",
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when both services fail", async () => {
    process.env.OPENCAGE_API_KEY = "test-key";

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false }) // Census fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }), // OpenCage no results
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await geocodeAddress("123 Main St", "Richland", "WA", "99352");
    expect(result).toBeNull();
  });

  it("returns null when census returns no matches", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { addressMatches: [] },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await geocodeAddress("Nonexistent St", "Nowhere", "WA", "00000");
    expect(result).toBeNull();
  });

  it("handles fetch timeout/error gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await geocodeAddress("123 Main St", "Richland", "WA", "99352");
    expect(result).toBeNull();
  });

  it("skips OpenCage when API key is not set", async () => {
    delete process.env.OPENCAGE_API_KEY;

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { addressMatches: [] },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await geocodeAddress("123 Main St", "Richland", "WA", "99352");
    expect(result).toBeNull();
    // Should only call Census, not OpenCage
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
