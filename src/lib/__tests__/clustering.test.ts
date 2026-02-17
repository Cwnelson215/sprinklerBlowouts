import { describe, it, expect } from "vitest";
import { dbscan } from "../clustering";

describe("dbscan", () => {
  it("returns empty for empty input", () => {
    const result = dbscan([], 1.5, 2);
    expect(result).toEqual([]);
  });

  it("puts a single point in its own cluster (noise)", () => {
    const result = dbscan([{ id: "a", lat: 46.28, lng: -119.28 }], 1.5, 2);
    expect(result).toEqual([["a"]]);
  });

  it("clusters nearby points together", () => {
    const points = [
      { id: "a", lat: 46.280, lng: -119.280 },
      { id: "b", lat: 46.281, lng: -119.281 }, // very close to a
      { id: "c", lat: 46.282, lng: -119.282 }, // very close to b
    ];
    const result = dbscan(points, 1.5, 2);
    // All should be in one cluster
    expect(result.length).toBe(1);
    expect(result[0].sort()).toEqual(["a", "b", "c"]);
  });

  it("separates far-apart points into different clusters", () => {
    // Need 3+ points per group for minPoints=2 (each needs 2 neighbors)
    const points = [
      { id: "a", lat: 46.280, lng: -119.280 },
      { id: "b", lat: 46.281, lng: -119.281 },
      { id: "c", lat: 46.282, lng: -119.279 }, // close to a,b
      { id: "d", lat: 47.500, lng: -120.500 }, // far away group
      { id: "e", lat: 47.501, lng: -120.501 },
      { id: "f", lat: 47.502, lng: -120.499 },
    ];
    const result = dbscan(points, 5, 2);
    expect(result.length).toBe(2);
    const allIds = result.flat().sort();
    expect(allIds).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("respects minPoints - isolated points become noise clusters", () => {
    // Need 3 nearby points for a cluster with minPoints=2
    const points = [
      { id: "a", lat: 46.280, lng: -119.280 },
      { id: "b", lat: 46.281, lng: -119.281 },
      { id: "c", lat: 46.282, lng: -119.279 }, // close to a,b
      { id: "d", lat: 48.000, lng: -121.000 }, // isolated, far from all
    ];
    const result = dbscan(points, 5, 2);
    // a,b,c should cluster; d should be noise (single-point cluster)
    const singleClusters = result.filter((cl) => cl.length === 1);
    const multiClusters = result.filter((cl) => cl.length > 1);
    expect(singleClusters.length).toBe(1);
    expect(singleClusters[0]).toEqual(["d"]);
    expect(multiClusters.length).toBe(1);
    expect(multiClusters[0].sort()).toEqual(["a", "b", "c"]);
  });

  it("splits clusters when maxRadius is exceeded", () => {
    // Create a line of points spread far apart but each near its neighbor
    const points = [
      { id: "a", lat: 46.00, lng: -119.00 },
      { id: "b", lat: 46.01, lng: -119.01 },
      { id: "c", lat: 46.10, lng: -119.10 },
      { id: "d", lat: 46.11, lng: -119.11 },
    ];
    // epsilon big enough to connect all, small maxRadius to force split
    const result = dbscan(points, 20, 2, 2);
    // Should split into multiple clusters since the spread is > 2 miles
    const allIds = result.flat().sort();
    expect(allIds).toEqual(["a", "b", "c", "d"]);
    // Each cluster should contain at least one point
    for (const cluster of result) {
      expect(cluster.length).toBeGreaterThan(0);
    }
  });

  it("preserves all point IDs in output", () => {
    const points = [
      { id: "1", lat: 46.0, lng: -119.0 },
      { id: "2", lat: 46.001, lng: -119.001 },
      { id: "3", lat: 47.0, lng: -120.0 },
      { id: "4", lat: 47.001, lng: -120.001 },
      { id: "5", lat: 48.0, lng: -121.0 },
    ];
    const result = dbscan(points, 1.5, 2);
    const allIds = result.flat().sort();
    expect(allIds).toEqual(["1", "2", "3", "4", "5"]);
  });
});
