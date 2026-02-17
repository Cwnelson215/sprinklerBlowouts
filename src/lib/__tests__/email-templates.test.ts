import { describe, it, expect } from "vitest";
import {
  confirmationEmail,
  reminderEmail,
  updateEmail,
  cancellationEmail,
} from "../email/templates";

const booking = {
  jobNumber: "SB-2026-ABCD",
  customerName: "John Doe",
  address: "123 Main St",
  city: "Richland",
  state: "WA",
  zip: "99352",
  date: "2026-10-15",
  timeOfDay: "MORNING",
  serviceType: "SPRINKLER_BLOWOUT",
};

describe("confirmationEmail", () => {
  it("includes job number in subject", () => {
    const result = confirmationEmail(booking);
    expect(result.subject).toContain("SB-2026-ABCD");
  });

  it("includes customer name in html", () => {
    const result = confirmationEmail(booking);
    expect(result.html).toContain("John Doe");
  });

  it("includes address in html", () => {
    const result = confirmationEmail(booking);
    expect(result.html).toContain("123 Main St");
  });

  it("includes lookup link", () => {
    const result = confirmationEmail(booking);
    expect(result.html).toContain("/lookup/SB-2026-ABCD");
  });

  it("includes service-specific content", () => {
    const result = confirmationEmail(booking);
    expect(result.html).toContain("Sprinkler Blowout");
  });

  it("uses backflow config for BACKFLOW_TESTING", () => {
    const bfBooking = { ...booking, serviceType: "BACKFLOW_TESTING", jobNumber: "BF-2026-EFGH" };
    const result = confirmationEmail(bfBooking);
    expect(result.html).toContain("Backflow Prevention Testing");
    expect(result.subject).toContain("BF-2026-EFGH");
  });
});

describe("reminderEmail", () => {
  it("includes job number in subject", () => {
    const result = reminderEmail(booking);
    expect(result.subject).toContain("SB-2026-ABCD");
  });

  it("includes reminder heading", () => {
    const result = reminderEmail(booking);
    expect(result.html).toContain("Tomorrow");
  });

  it("includes customer name", () => {
    const result = reminderEmail(booking);
    expect(result.html).toContain("John Doe");
  });
});

describe("updateEmail", () => {
  it("includes update description", () => {
    const result = updateEmail(booking, "Date changed to Oct 20");
    expect(result.html).toContain("Date changed to Oct 20");
  });

  it("includes job number in subject", () => {
    const result = updateEmail(booking, "updated");
    expect(result.subject).toContain("SB-2026-ABCD");
  });
});

describe("cancellationEmail", () => {
  it("includes job number in subject", () => {
    const result = cancellationEmail(booking);
    expect(result.subject).toContain("SB-2026-ABCD");
  });

  it("includes cancellation styling", () => {
    const result = cancellationEmail(booking);
    expect(result.html).toContain("Cancelled");
  });

  it("includes booking link", () => {
    const result = cancellationEmail(booking);
    expect(result.html).toContain("/booking");
  });

  it("uses backflow cancellation text", () => {
    const bfBooking = { ...booking, serviceType: "BACKFLOW_TESTING" };
    const result = cancellationEmail(bfBooking);
    expect(result.html).toContain("backflow prevention");
  });
});
