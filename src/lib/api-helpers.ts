import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { getAdminFromRequest, AdminPayload } from "./auth";
import { checkRateLimit } from "./rate-limit";

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;

type AdminHandler = (req: NextRequest, admin: AdminPayload, ...args: unknown[]) => Promise<NextResponse>;

/**
 * Wraps a route handler with try-catch and a standardized 500 response.
 */
export function withErrorHandler(label: string, handler: RouteHandler): RouteHandler {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      console.error(`${label}:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

interface WithAdminOptions {
  requireSuperAdmin?: boolean;
}

/**
 * Wraps a route handler with admin auth check + error handling.
 */
export function withAdmin(
  label: string,
  handler: AdminHandler,
  options?: WithAdminOptions
): RouteHandler {
  return withErrorHandler(label, async (req, ...args) => {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (options?.requireSuperAdmin && admin.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, admin, ...args);
  });
}

/**
 * Parses request body with a Zod schema and returns a standardized 400 on failure.
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data };
}

/**
 * Checks rate limit for the request and returns a 429 response if exceeded.
 * Returns null if allowed, a NextResponse if rate-limited.
 */
export function applyRateLimit(
  req: NextRequest,
  keyPrefix: string,
  maxAttempts: number,
  windowMs: number
): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`${keyPrefix}:${ip}`, maxAttempts, windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.retryAfterMs || 0) / 1000)),
        },
      }
    );
  }
  return null;
}
