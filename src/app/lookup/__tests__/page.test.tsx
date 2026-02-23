// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LookupPage from "../page";

describe("LookupPage", () => {
  it("renders the 'Back to Home' link pointing to /", () => {
    render(<LookupPage />);
    const link = screen.getByText("Back to Home");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders the job number input and 'Find Booking' button", () => {
    render(<LookupPage />);
    expect(screen.getByLabelText("Job Number")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find Booking" })
    ).toBeInTheDocument();
  });

  it("renders the 'Sprinkler Services' header link to /", () => {
    render(<LookupPage />);
    const link = screen.getByText("Sprinkler Services");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders the 'Book Now' link to /booking", () => {
    render(<LookupPage />);
    const link = screen.getByText("Book Now");
    expect(link.closest("a")).toHaveAttribute("href", "/booking");
  });
});
