import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { adminLoginSchema, adminSeedSchema } from "@/lib/validation";
import { signToken, setAuthCookie, clearAuthCookie } from "@/lib/auth";
import { AdminUser } from "@/lib/types";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const admins = await db
      .collection<AdminUser>("admin_users")
      .find()
      .toArray();

    let admin: AdminUser | null = null;
    for (const candidate of admins) {
      const valid = await compare(parsed.data.password, candidate.passwordHash);
      if (valid) {
        admin = candidate;
        break;
      }
    }

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await signToken({
      id: admin._id.toHexString(),
      email: admin.email,
      role: admin.role,
    });

    return NextResponse.json(
      { email: admin.email, role: admin.role },
      { status: 200, headers: setAuthCookie(token) }
    );
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: clearAuthCookie() }
  );
}

// Seed endpoint - creates initial admin if none exist
export async function PUT(req: NextRequest) {
  if (process.env.ALLOW_ADMIN_SEED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const db = await getDb();
    const count = await db.collection<AdminUser>("admin_users").countDocuments();

    if (count > 0) {
      return NextResponse.json(
        { error: "Admin users already exist" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = adminSeedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const now = new Date();

    await db.collection("admin_users").insertOne({
      email: parsed.data.email,
      passwordHash,
      role: "SUPER_ADMIN",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { email: parsed.data.email, role: "SUPER_ADMIN" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
