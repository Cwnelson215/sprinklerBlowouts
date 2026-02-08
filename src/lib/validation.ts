import { z } from "zod";

export const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "Use 2-letter state code").default("CO"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  preferredTime: z.enum(["MORNING", "AFTERNOON", "EVENING"], {
    errorMap: () => ({ message: "Please select a preferred time" }),
  }),
  notes: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  zoneId: z.string().optional(),
  availableDateId: z.string().optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const bookingUpdateSchema = z.object({
  availableDateId: z.string().optional(),
  customerName: z.string().min(2).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["CANCELLED"]).optional(),
});

export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const zoneSchema = z.object({
  name: z.string().min(2),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMi: z.number().min(1).max(100).default(15),
  isActive: z.boolean().default(true),
});

export const availableDateSchema = z.object({
  zoneId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeOfDay: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
  maxBookings: z.number().int().min(1).max(100).default(20),
});
