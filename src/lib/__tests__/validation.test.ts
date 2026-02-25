import { describe, it, expect } from "vitest";
import {
  bookingSchema,
  bookingUpdateSchema,
  adminLoginSchema,
  adminSeedSchema,
  zoneSchema,
  availableDateSchema,
} from "../validation";

describe("bookingSchema", () => {
  const validBooking = {
    serviceType: "SPRINKLER_BLOWOUT",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    address: "123 Main St",
    city: "Richland",
    state: "WA",
    zip: "99352",
    preferredTime: "MORNING",
  };

  it("accepts valid input", () => {
    const result = bookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it("defaults state to WA", () => {
    const { state, ...rest } = validBooking;
    const result = bookingSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe("WA");
    }
  });

  it("rejects invalid service type", () => {
    const result = bookingSchema.safeParse({ ...validBooking, serviceType: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects short customer name", () => {
    const result = bookingSchema.safeParse({ ...validBooking, customerName: "J" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = bookingSchema.safeParse({ ...validBooking, customerEmail: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid zip code", () => {
    const result = bookingSchema.safeParse({ ...validBooking, zip: "1234" });
    expect(result.success).toBe(false);
  });

  it("accepts zip+4 format", () => {
    const result = bookingSchema.safeParse({ ...validBooking, zip: "99352-1234" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid bookedTime format", () => {
    const result = bookingSchema.safeParse({ ...validBooking, bookedTime: "8:00" });
    expect(result.success).toBe(false);
  });

  it("accepts valid bookedTime", () => {
    const result = bookingSchema.safeParse({ ...validBooking, bookedTime: "08:00" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid preferredTime", () => {
    const result = bookingSchema.safeParse({ ...validBooking, preferredTime: "NIGHT" });
    expect(result.success).toBe(false);
  });
});

describe("bookingUpdateSchema", () => {
  it("accepts valid update with status CANCELLED", () => {
    const result = bookingUpdateSchema.safeParse({ status: "CANCELLED" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = bookingUpdateSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(false);
  });

  it("accepts empty object", () => {
    const result = bookingUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial updates", () => {
    const result = bookingUpdateSchema.safeParse({ customerName: "Jane Doe" });
    expect(result.success).toBe(true);
  });
});

describe("adminLoginSchema", () => {
  it("accepts valid password", () => {
    const result = adminLoginSchema.safeParse({ password: "longpassword" });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = adminLoginSchema.safeParse({ password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("adminSeedSchema", () => {
  it("accepts valid input", () => {
    const result = adminSeedSchema.safeParse({
      email: "admin@example.com",
      password: "LongPassword1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = adminSeedSchema.safeParse({
      email: "not-an-email",
      password: "LongPassword1",
    });
    expect(result.success).toBe(false);
  });
});

describe("zoneSchema", () => {
  it("accepts valid zone", () => {
    const result = zoneSchema.safeParse({
      name: "Tri-Cities",
      centerLat: 46.28,
      centerLng: -119.28,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radiusMi).toBe(15);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("rejects latitude out of range", () => {
    const result = zoneSchema.safeParse({
      name: "Zone",
      centerLat: 100,
      centerLng: -119,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    const result = zoneSchema.safeParse({
      name: "Zone",
      centerLat: 46,
      centerLng: -200,
    });
    expect(result.success).toBe(false);
  });

  it("rejects radius > 100", () => {
    const result = zoneSchema.safeParse({
      name: "Zone",
      centerLat: 46,
      centerLng: -119,
      radiusMi: 101,
    });
    expect(result.success).toBe(false);
  });
});

describe("availableDateSchema", () => {
  it("accepts valid input", () => {
    const result = availableDateSchema.safeParse({
      zoneId: "507f1f77bcf86cd799439011",
      date: "2026-10-15",
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxBookings).toBe(20);
      expect(result.data.disabledTimes).toEqual([]);
    }
  });

  it("rejects invalid date format", () => {
    const result = availableDateSchema.safeParse({
      zoneId: "507f1f77bcf86cd799439011",
      date: "10/15/2026",
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid timeOfDay", () => {
    const result = availableDateSchema.safeParse({
      zoneId: "507f1f77bcf86cd799439011",
      date: "2026-10-15",
      timeOfDay: "NIGHT",
      serviceType: "SPRINKLER_BLOWOUT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxBookings > 100", () => {
    const result = availableDateSchema.safeParse({
      zoneId: "507f1f77bcf86cd799439011",
      date: "2026-10-15",
      timeOfDay: "MORNING",
      serviceType: "SPRINKLER_BLOWOUT",
      maxBookings: 101,
    });
    expect(result.success).toBe(false);
  });
});
