import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  signToken,
  verifyToken,
  getAdminFromRequest,
  setAuthCookie,
  clearAuthCookie,
  AdminPayload,
} from "../auth";

const testPayload: AdminPayload = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
};

describe("signToken / verifyToken", () => {
  it("round-trips a payload", async () => {
    const token = await signToken(testPayload);
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(testPayload.id);
    expect(result!.email).toBe(testPayload.email);
    expect(result!.role).toBe(testPayload.role);
  });

  it("returns null for invalid token", async () => {
    const result = await verifyToken("not-a-real-token");
    expect(result).toBeNull();
  });

  it("returns null for tampered token", async () => {
    const token = await signToken(testPayload);
    // Corrupt the token by changing a character
    const corrupted = token.slice(0, -5) + "XXXXX";
    const result = await verifyToken(corrupted);
    expect(result).toBeNull();
  });
});

describe("getAdminFromRequest", () => {
  it("returns payload for valid cookie", async () => {
    const token = await signToken(testPayload);
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { "Content-Type": "application/json" },
    });
    req.cookies.set("admin_token", token);

    const result = await getAdminFromRequest(req);
    expect(result).not.toBeNull();
    expect(result!.email).toBe("admin@example.com");
  });

  it("returns null when no cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/test");
    const result = await getAdminFromRequest(req);
    expect(result).toBeNull();
  });

  it("returns null for invalid cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/test");
    req.cookies.set("admin_token", "garbage-token");
    const result = await getAdminFromRequest(req);
    expect(result).toBeNull();
  });
});

describe("setAuthCookie", () => {
  it("returns Set-Cookie header with correct attributes", () => {
    const headers = setAuthCookie("mytoken123");
    const cookie = headers["Set-Cookie"];
    expect(cookie).toContain("admin_token=mytoken123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=7200"); // 2 * 60 * 60
    expect(cookie).toContain("Path=/");
  });
});

describe("clearAuthCookie", () => {
  it("returns Set-Cookie header with Max-Age=0", () => {
    const headers = clearAuthCookie();
    const cookie = headers["Set-Cookie"];
    expect(cookie).toContain("admin_token=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
  });
});
