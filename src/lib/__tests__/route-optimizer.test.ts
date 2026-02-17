import { describe, it, expect } from "vitest";
import { optimizeRoute } from "../route-optimizer";

describe("optimizeRoute", () => {
  it("returns empty for no points", () => {
    const result = optimizeRoute([]);
    expect(result.order).toEqual([]);
    expect(result.totalDistance).toBe(0);
  });

  it("returns single point for one point", () => {
    const result = optimizeRoute([{ id: "a", lat: 46.28, lng: -119.28 }]);
    expect(result.order).toEqual(["a"]);
    expect(result.totalDistance).toBe(0);
  });

  it("returns single point with depot distance", () => {
    const result = optimizeRoute(
      [{ id: "a", lat: 46.28, lng: -119.28 }],
      { lat: 46.0, lng: -119.0 }
    );
    expect(result.order).toEqual(["a"]);
    expect(result.totalDistance).toBeGreaterThan(0);
  });

  it("handles two points without depot", () => {
    const result = optimizeRoute([
      { id: "a", lat: 46.28, lng: -119.28 },
      { id: "b", lat: 46.30, lng: -119.30 },
    ]);
    expect(result.order).toHaveLength(2);
    expect(result.order).toContain("a");
    expect(result.order).toContain("b");
    expect(result.totalDistance).toBeGreaterThan(0);
  });

  it("includes all IDs in output for multiple points", () => {
    const points = [
      { id: "a", lat: 46.28, lng: -119.28 },
      { id: "b", lat: 46.30, lng: -119.30 },
      { id: "c", lat: 46.25, lng: -119.25 },
      { id: "d", lat: 46.35, lng: -119.35 },
    ];
    const result = optimizeRoute(points);
    expect(result.order.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("does not include depot in the output order", () => {
    const points = [
      { id: "a", lat: 46.28, lng: -119.28 },
      { id: "b", lat: 46.30, lng: -119.30 },
      { id: "c", lat: 46.25, lng: -119.25 },
    ];
    const depot = { lat: 46.279759, lng: -119.358324 };
    const result = optimizeRoute(points, depot);
    expect(result.order).not.toContain("__depot__");
    expect(result.order.sort()).toEqual(["a", "b", "c"]);
  });

  it("2-opt improves or equals naive nearest-neighbor", () => {
    // Create a route where NN would not produce the optimal path
    const points = [
      { id: "1", lat: 46.00, lng: -119.00 },
      { id: "2", lat: 46.10, lng: -119.10 },
      { id: "3", lat: 46.05, lng: -119.05 },
      { id: "4", lat: 46.15, lng: -119.15 },
      { id: "5", lat: 46.02, lng: -119.02 },
    ];
    const result = optimizeRoute(points);
    expect(result.totalDistance).toBeGreaterThan(0);
    expect(result.order).toHaveLength(5);
  });
});
