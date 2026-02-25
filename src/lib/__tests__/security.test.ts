import { describe, it, expect } from "vitest";
import { escapeRegex, sanitizeError, clampPagination, isValidObjectId } from "../security";

describe("escapeRegex", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegex("hello.*world")).toBe("hello\\.\\*world");
  });

  it("escapes all special characters", () => {
    expect(escapeRegex("a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o")).toBe(
      "a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o"
    );
  });

  it("returns plain strings unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
});

describe("sanitizeError", () => {
  it("identifies SyntaxError", () => {
    expect(sanitizeError(new SyntaxError("bad json"))).toBe("Invalid JSON");
  });

  it("identifies TypeError", () => {
    expect(sanitizeError(new TypeError("bad type"))).toBe("Type error");
  });

  it("identifies RangeError", () => {
    expect(sanitizeError(new RangeError("bad range"))).toBe("Range error");
  });

  it("returns generic message for unknown errors", () => {
    expect(sanitizeError(new Error("secret stuff"))).toBe("Internal server error");
    expect(sanitizeError("string error")).toBe("Internal server error");
    expect(sanitizeError(null)).toBe("Internal server error");
  });
});

describe("clampPagination", () => {
  it("returns defaults for null inputs", () => {
    expect(clampPagination(null, null)).toEqual({ page: 1, limit: 20 });
  });

  it("clamps page to minimum 1", () => {
    expect(clampPagination("-5", "10")).toEqual({ page: 1, limit: 10 });
    expect(clampPagination("0", "10")).toEqual({ page: 1, limit: 10 });
  });

  it("clamps limit to maxLimit", () => {
    expect(clampPagination("1", "500")).toEqual({ page: 1, limit: 100 });
    expect(clampPagination("1", "500", 50)).toEqual({ page: 1, limit: 50 });
  });

  it("clamps limit to minimum 1", () => {
    expect(clampPagination("1", "0")).toEqual({ page: 1, limit: 1 });
    expect(clampPagination("1", "-10")).toEqual({ page: 1, limit: 1 });
  });

  it("handles non-numeric strings", () => {
    expect(clampPagination("abc", "xyz")).toEqual({ page: 1, limit: 20 });
  });

  it("floors decimal values", () => {
    expect(clampPagination("2.7", "15.9")).toEqual({ page: 2, limit: 15 });
  });
});

describe("isValidObjectId", () => {
  it("accepts valid ObjectId strings", () => {
    expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    expect(isValidObjectId("aabbccddeeff00112233aabb")).toBe(true);
  });

  it("rejects invalid ObjectId strings", () => {
    expect(isValidObjectId("invalid")).toBe(false);
    expect(isValidObjectId("")).toBe(false);
    expect(isValidObjectId("507f1f77bcf86cd79943901")).toBe(false); // 23 chars
    expect(isValidObjectId("507f1f77bcf86cd7994390111")).toBe(false); // 25 chars
    expect(isValidObjectId("507f1f77bcf86cd79943901g")).toBe(false); // invalid char
  });
});
