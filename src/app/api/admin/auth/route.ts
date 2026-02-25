import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { adminLoginSchema, adminSeedSchema } from "@/lib/validation";
import { signToken, setAuthCookie, clearAuthCookie } from "@/lib/auth";
import { AdminUser } from "@/lib/types";
import { withErrorHandler, parseBody, applyRateLimit } from "@/lib/api-helpers";

export const POST = withErrorHandler("Auth error", async (req: NextRequest) => {
  const rateLimited = applyRateLimit(req, "login", 5, 15 * 60 * 1000);
  if (rateLimited) return rateLimited;

  const { data, error } = await parseBody(req, adminLoginSchema);
  if (error) return error;

  const db = await getDb();
  const admins = await db
    .collection<AdminUser>("admin_users")
    .find()
    .toArray();

  let admin: AdminUser | null = null;
  for (const candidate of admins) {
    const valid = await compare(data.password, candidate.passwordHash);
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
});

export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: clearAuthCookie() }
  );
}

// Seed endpoint - creates initial admin if none exist
export const PUT = withErrorHandler("Seed error", async (req: NextRequest) => {
  if (process.env.ALLOW_ADMIN_SEED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await getDb();
  const count = await db.collection<AdminUser>("admin_users").countDocuments();

  if (count > 0) {
    return NextResponse.json(
      { error: "Admin users already exist" },
      { status: 400 }
    );
  }

  const { data, error } = await parseBody(req, adminSeedSchema);
  if (error) return error;

  const passwordHash = await hash(data.password, 12);
  const now = new Date();

  await db.collection("admin_users").insertOne({
    email: data.email,
    passwordHash,
    role: "SUPER_ADMIN",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    { email: data.email, role: "SUPER_ADMIN" },
    { status: 201 }
  );
});
