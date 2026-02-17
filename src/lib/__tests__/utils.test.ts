import { describe, it, expect } from "vitest";
import { generateJobNumber, haversineDistance, cn } from "../utils";

describe("generateJobNumber", () => {
  it("produces format {prefix}-{year}-{4chars}", () => {
    const jn = generateJobNumber("SB");
    const year = new Date().getFullYear();
    expect(jn).toMatch(new RegExp(`^SB-${year}-[A-Z2-9]{4}$`));
  });

  it("uses custom prefix", () => {
    const jn = generateJobNumber("BF");
    expect(jn).toMatch(/^BF-/);
  });

  it("defaults prefix to SB", () => {
    const jn = generateJobNumber();
    expect(jn).toMatch(/^SB-/);
  });

  it("only uses allowed characters", () => {
    const allowed = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    for (let i = 0; i < 100; i++) {
      const jn = generateJobNumber();
      const code = jn.split("-")[2];
      for (const ch of code) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it("generates unique values across 100 calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(generateJobNumber());
    }
    expect(set.size).toBe(100);
  });
});

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistance(46.28, -119.28, 46.28, -119.28)).toBe(0);
  });

  it("returns correct distance for Richland to Kennewick (~5-6 mi)", () => {
    // Richland: 46.2856, -119.2845
    // Kennewick: 46.2112, -119.1372
    const d = haversineDistance(46.2856, -119.2845, 46.2112, -119.1372);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(9);
  });

  it("is symmetric", () => {
    const d1 = haversineDistance(46.28, -119.28, 47.0, -120.0);
    const d2 = haversineDistance(47.0, -120.0, 46.28, -119.28);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it("handles poles", () => {
    const d = haversineDistance(90, 0, -90, 0);
    // Half the Earth circumference in miles: ~12,450 mi
    expect(d).toBeGreaterThan(12000);
    expect(d).toBeLessThan(13000);
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("resolves Tailwind conflicts", () => {
    // tailwind-merge should resolve p-2 vs p-4
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });
});
