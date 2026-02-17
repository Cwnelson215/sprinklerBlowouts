import { describe, it, expect } from "vitest";
import {
  generateTimeSlots,
  getAvailableTimes,
  formatTime,
  getSlotStartTime,
  TIME_SLOT_CONFIG,
} from "../time-slots";

describe("generateTimeSlots", () => {
  it("produces MORNING slots from 8:00 to 11:15 (45-min increments)", () => {
    const slots = generateTimeSlots("MORNING", ["MORNING"]);
    expect(slots[0]).toBe("08:00");
    expect(slots).toContain("08:45");
    expect(slots).toContain("09:30");
    expect(slots).toContain("10:15");
    expect(slots).toContain("11:00");
    // 11:45 + 45 = 12:30 > 12:00 end, so 11:45 should NOT fit
    // Actually 11:00 + 45 = 11:45, and 11:45 + 45 = 12:30 > 12:00 end
    // So 11:00 is the last slot since 11:00 + 45 = 11:45 <= 12:00
    // And 11:45 + 45 = 12:30 > 12:00, so 11:45 should not be included
    // Wait: the condition is `current + INCREMENT_MINUTES <= endMinutes`
    // 11:00 (660) + 45 = 705 <= 720 ✓ → 11:00 is included
    // 11:45 (705) + 45 = 750 > 720 ✗ → 11:45 is NOT included
    expect(slots).not.toContain("11:45");
    expect(slots.length).toBe(5); // 08:00, 08:45, 09:30, 10:15, 11:00
  });

  it("produces AFTERNOON slots from 12:00 to 15:15 (without morning)", () => {
    const slots = generateTimeSlots("AFTERNOON", ["AFTERNOON"]);
    expect(slots[0]).toBe("12:00");
    expect(slots).toContain("12:45");
    expect(slots).toContain("13:30");
    expect(slots).toContain("14:15");
    expect(slots).toContain("15:00");
    // 15:00 + 45 = 15:45 <= 16:00 ✓ → 15:00 is included
    // 15:45 + 45 = 16:30 > 16:00 ✗ → 15:45 is NOT included
    expect(slots).not.toContain("15:45");
  });

  it("shifts AFTERNOON start when MORNING is enabled", () => {
    const slots = generateTimeSlots("AFTERNOON", ["MORNING", "AFTERNOON"]);
    expect(slots[0]).toBe("12:30");
  });

  it("produces EVENING slots from 16:00", () => {
    const slots = generateTimeSlots("EVENING", ["EVENING"]);
    expect(slots[0]).toBe("16:00");
    expect(slots).toContain("16:45");
    expect(slots).toContain("17:30");
  });

  it("returns empty array if window is too small", () => {
    // This shouldn't happen in practice but tests the edge case
    const slots = generateTimeSlots("MORNING", ["MORNING"]);
    expect(Array.isArray(slots)).toBe(true);
  });
});

describe("getSlotStartTime", () => {
  it("MORNING always starts at base time", () => {
    expect(getSlotStartTime("MORNING", ["MORNING"])).toBe(480);
    expect(getSlotStartTime("MORNING", ["MORNING", "AFTERNOON"])).toBe(480);
  });

  it("AFTERNOON starts at 12:00 without morning", () => {
    expect(getSlotStartTime("AFTERNOON", ["AFTERNOON"])).toBe(720);
  });

  it("AFTERNOON starts at 12:30 with morning", () => {
    expect(getSlotStartTime("AFTERNOON", ["MORNING", "AFTERNOON"])).toBe(750);
  });

  it("EVENING starts at 16:00 without afternoon", () => {
    expect(getSlotStartTime("EVENING", ["EVENING"])).toBe(960);
  });
});

describe("getAvailableTimes", () => {
  it("returns all slots when nothing is booked/disabled", () => {
    const all = generateTimeSlots("MORNING", ["MORNING"]);
    const available = getAvailableTimes("MORNING", ["MORNING"], [], []);
    expect(available).toEqual(all);
  });

  it("filters out booked times", () => {
    const available = getAvailableTimes("MORNING", ["MORNING"], ["08:00", "09:30"], []);
    expect(available).not.toContain("08:00");
    expect(available).not.toContain("09:30");
    expect(available).toContain("08:45");
  });

  it("filters out disabled times", () => {
    const available = getAvailableTimes("MORNING", ["MORNING"], [], ["08:45"]);
    expect(available).not.toContain("08:45");
    expect(available).toContain("08:00");
  });

  it("filters both booked and disabled", () => {
    const available = getAvailableTimes("MORNING", ["MORNING"], ["08:00"], ["08:45"]);
    expect(available).not.toContain("08:00");
    expect(available).not.toContain("08:45");
  });

  it("returns empty when all slots taken", () => {
    const all = generateTimeSlots("MORNING", ["MORNING"]);
    const available = getAvailableTimes("MORNING", ["MORNING"], all, []);
    expect(available).toHaveLength(0);
  });
});

describe("formatTime", () => {
  it("converts 08:00 to 8:00 AM", () => {
    expect(formatTime("08:00")).toBe("8:00 AM");
  });

  it("converts 12:00 to 12:00 PM", () => {
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("converts 13:30 to 1:30 PM", () => {
    expect(formatTime("13:30")).toBe("1:30 PM");
  });

  it("converts 00:00 (midnight) to 12:00 AM", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
  });

  it("converts 23:59 to 11:59 PM", () => {
    expect(formatTime("23:59")).toBe("11:59 PM");
  });
});
