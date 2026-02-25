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
