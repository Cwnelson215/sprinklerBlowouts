import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  // Use unique keys per test to avoid cross-test interference
  let keyCounter = 0;
  function uniqueKey() {
    return `test-key-${++keyCounter}-${Date.now()}`;
  }

  it("allows requests under the limit", () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over the limit", () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("uses separate counters for different keys", () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key1, 5, 60_000);
    }
    const result1 = checkRateLimit(key1, 5, 60_000);
    const result2 = checkRateLimit(key2, 5, 60_000);
    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });

  it("allows requests after window expires", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 50); // 50ms window
    }
    const blocked = checkRateLimit(key, 5, 50);
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));

    const result = checkRateLimit(key, 5, 50);
    expect(result.allowed).toBe(true);
  });
});
