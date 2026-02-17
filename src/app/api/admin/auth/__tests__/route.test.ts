import { describe, it, expect } from "vitest";
import { createRequest } from "@/test/helpers/request";
import { createTestAdmin } from "@/test/helpers/db";
import { POST, DELETE, PUT } from "../route";

describe("POST /api/admin/auth (login)", () => {
  it("returns 400 for invalid input", async () => {
    const req = createRequest("/api/admin/auth", {
      method: "POST",
      body: { password: "short" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for wrong password", async () => {
    await createTestAdmin();
    const req = createRequest("/api/admin/auth", {
      method: "POST",
      body: { password: "wrong-password-here" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with Set-Cookie on valid login", async () => {
    await createTestAdmin();
    const req = createRequest("/api/admin/auth", {
      method: "POST",
      body: { password: "TestPassword123" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("admin@example.com");
    expect(body.role).toBe("SUPER_ADMIN");
    expect(res.headers.get("Set-Cookie")).toContain("admin_token=");
  });
});

describe("DELETE /api/admin/auth (logout)", () => {
  it("clears cookie and returns ok", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("PUT /api/admin/auth (seed)", () => {
  it("creates first admin with 201", async () => {
    const req = createRequest("/api/admin/auth", {
      method: "PUT",
      body: { email: "newadmin@example.com", password: "securepassword" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("newadmin@example.com");
    expect(body.role).toBe("SUPER_ADMIN");
  });

  it("returns 400 if admins already exist", async () => {
    await createTestAdmin();
    const req = createRequest("/api/admin/auth", {
      method: "PUT",
      body: { email: "another@example.com", password: "securepassword" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already exist");
  });

  it("returns 400 for invalid seed input", async () => {
    const req = createRequest("/api/admin/auth", {
      method: "PUT",
      body: { email: "not-valid", password: "short" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
