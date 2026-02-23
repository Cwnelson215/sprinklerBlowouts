import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// Only run cleanup in jsdom environment
if (typeof document !== "undefined") {
  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  });
}

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  })),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next/link to render as a plain <a> tag
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});
