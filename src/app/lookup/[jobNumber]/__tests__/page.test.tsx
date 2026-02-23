// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useParams } from "next/navigation";
import BookingDetailPage from "../page";

const mockUseParams = vi.mocked(useParams);

const bookingFixture = {
  jobNumber: "SB-2026-A3F7",
  serviceType: "SPRINKLER_BLOWOUT",
  customerName: "John Doe",
  customerEmail: "john@example.com",
  customerPhone: "509-555-1234",
  address: "123 Main St",
  city: "Richland",
  state: "WA",
  zip: "99352",
  preferredTime: "MORNING",
  status: "SCHEDULED",
  notes: null,
  zoneName: "Tri-Cities",
  scheduledDate: "2026-10-15T00:00:00.000Z",
  scheduledTime: "MORNING",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mockUseParams.mockReturnValue({ jobNumber: "SB-2026-A3F7" });
  vi.restoreAllMocks();
  mockUseParams.mockReturnValue({ jobNumber: "SB-2026-A3F7" });
});

function mockFetchSuccess(data = bookingFixture) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFailure() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: "Booking not found" }),
  });
}

describe("BookingDetailPage", () => {
  it("renders the 'Back to Home' link pointing to /", async () => {
    mockFetchSuccess();
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to Home")).toBeInTheDocument();
    });
    const link = screen.getByText("Back to Home");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders booking details", async () => {
    mockFetchSuccess();
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("SB-2026-A3F7")).toBeInTheDocument();
    });
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText("SCHEDULED")).toBeInTheDocument();
  });

  it("shows cancel button for cancellable statuses", async () => {
    mockFetchSuccess({ ...bookingFixture, status: "PENDING" });
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel Booking" })
      ).toBeInTheDocument();
    });
  });

  it("hides cancel button for COMPLETED status", async () => {
    mockFetchSuccess({ ...bookingFixture, status: "COMPLETED" });
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("SB-2026-A3F7")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Cancel Booking" })
    ).not.toBeInTheDocument();
  });

  it("hides cancel button for CANCELLED status", async () => {
    mockFetchSuccess({ ...bookingFixture, status: "CANCELLED" });
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("SB-2026-A3F7")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Cancel Booking" })
    ).not.toBeInTheDocument();
  });

  it("hides cancel button for IN_PROGRESS status", async () => {
    mockFetchSuccess({ ...bookingFixture, status: "IN_PROGRESS" });
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("SB-2026-A3F7")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Cancel Booking" })
    ).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    mockFetchFailure();
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Could not find booking. Please check your job number.")
      ).toBeInTheDocument();
    });
  });

  it("error state includes 'Try another job number' link", async () => {
    mockFetchFailure();
    render(<BookingDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Try another job number")).toBeInTheDocument();
    });
    const link = screen.getByText("Try another job number");
    expect(link.closest("a")).toHaveAttribute("href", "/lookup");
  });
});
