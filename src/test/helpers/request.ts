import { NextRequest } from "next/server";

interface RequestOptions {
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

export function createRequest(
  url: string,
  options: RequestOptions = {}
): NextRequest {
  const { method = "GET", body, cookies, headers = {} } = options;

  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const req = new NextRequest(new URL(url, "http://localhost:3000"), init);

  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value);
    }
  }

  return req;
}
