import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

const COOKIE_NAME = "admin_token";

export interface AdminPayload {
  id: string;
  email: string;
  role: string;
}

export async function signToken(payload: AdminPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminPayload;
  } catch {
    return null;
  }
}

export async function getAdminFromCookies(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getAdminFromRequest(
  req: NextRequest
): Promise<AdminPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(token: string) {
  return {
    "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${8 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}

export function clearAuthCookie() {
  return {
    "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`,
  };
}
