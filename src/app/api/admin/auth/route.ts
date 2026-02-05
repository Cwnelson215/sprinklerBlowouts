import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { adminLoginSchema } from "@/lib/validation";
import { signToken, setAuthCookie, clearAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      );
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: parsed.data.email },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await compare(parsed.data.password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await signToken({
      id: admin.id,
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
  try {
    const count = await prisma.adminUser.count();
    if (count > 0) {
      return NextResponse.json(
        { error: "Admin users already exist" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 12);

    const admin = await prisma.adminUser.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });

    return NextResponse.json(
      { email: admin.email, role: admin.role },
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
