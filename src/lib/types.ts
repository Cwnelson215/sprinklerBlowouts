import { ObjectId } from "mongodb";

// Enums as const objects for runtime use
export const ServiceType = {
  SPRINKLER_BLOWOUT: "SPRINKLER_BLOWOUT",
  BACKFLOW_TESTING: "BACKFLOW_TESTING",
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const TimeOfDay = {
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  EVENING: "EVENING",
} as const;
export type TimeOfDay = (typeof TimeOfDay)[keyof typeof TimeOfDay];

export const BookingStatus = {
  PENDING: "PENDING",
  AWAITING_SCHEDULE: "AWAITING_SCHEDULE",
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const AdminRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OPERATOR: "OPERATOR",
} as const;
export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const EmailType = {
  CONFIRMATION: "CONFIRMATION",
  REMINDER: "REMINDER",
  UPDATE: "UPDATE",
  CANCELLATION: "CANCELLATION",
} as const;
export type EmailType = (typeof EmailType)[keyof typeof EmailType];

export const JobStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// Document interfaces
export interface ServiceZone {
  _id: ObjectId;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMi: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailableDate {
  _id: ObjectId;
  zoneId: ObjectId;
  date: Date;
  timeOfDay: TimeOfDay;
  serviceType: ServiceType;
  maxBookings: number;
  disabledTimes: string[]; // e.g., ["08:00", "09:30"] - disabled by admin
  createdAt: Date;
}

export interface Booking {
  _id: ObjectId;
  jobNumber: string;
  serviceType: ServiceType;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number | null;
  lng?: number | null;
  preferredTime: TimeOfDay;
  bookedTime: string | null; // e.g., "08:00", "08:45", "14:30"
  status: BookingStatus;
  notes?: string | null;
  zoneId?: ObjectId | null;
  availableDateId?: ObjectId | null;
  routeGroupId?: ObjectId | null;
  routeOrder?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteGroup {
  _id: ObjectId;
  zoneId: ObjectId;
  date: Date;
  timeOfDay?: TimeOfDay;
  serviceType: ServiceType;
  optimizedRoute?: unknown;
  estimatedDuration?: number | null;
  estimatedDistance?: number | null;
  houseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUser {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  role: AdminRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLog {
  _id: ObjectId;
  bookingId: ObjectId;
  emailType: EmailType;
  to: string;
  subject: string;
  sentAt: Date;
  success: boolean;
  error?: string | null;
}

export interface Job {
  _id: ObjectId;
  name: string;
  data: unknown;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lastError?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
}
