export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeError(error: unknown): string {
  if (error instanceof SyntaxError) return "Invalid JSON";
  if (error instanceof TypeError) return "Type error";
  if (error instanceof RangeError) return "Range error";
  return "Internal server error";
}

export function clampPagination(
  page: string | null,
  limit: string | null,
  maxLimit = 100
): { page: number; limit: number } {
  const rawPage = page != null ? Number(page) : NaN;
  const rawLimit = limit != null ? Number(limit) : NaN;
  const p = Math.max(1, Number.isFinite(rawPage) ? Math.floor(rawPage) : 1);
  const l = Math.min(maxLimit, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20));
  return { page: p, limit: l };
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(value: string): boolean {
  return OBJECT_ID_RE.test(value);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return `**@${domain || "***"}`;
  return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 6) return phone;
  const visible = cleaned.slice(0, 2) + "*".repeat(cleaned.length - 6) + cleaned.slice(-4);
  return visible;
}
