import { signToken, AdminPayload } from "@/lib/auth";

export async function generateTestToken(
  overrides: Partial<AdminPayload> = {}
): Promise<string> {
  const payload: AdminPayload = {
    id: "507f1f77bcf86cd799439011",
    email: "admin@example.com",
    role: "SUPER_ADMIN",
    ...overrides,
  };
  return signToken(payload);
}

export async function generateOperatorToken(): Promise<string> {
  return generateTestToken({
    id: "507f1f77bcf86cd799439012",
    email: "operator@example.com",
    role: "OPERATOR",
  });
}
