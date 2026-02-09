import { TimeOfDay } from "./types";

// Time slot configuration with base start/end times (in minutes from midnight)
export const TIME_SLOT_CONFIG = {
  MORNING: {
    baseStart: 8 * 60, // 8:00 AM = 480 minutes
    baseEnd: 12 * 60, // 12:00 PM = 720 minutes
  },
  AFTERNOON: {
    baseStart: 12 * 60, // 12:00 PM = 720 minutes
    baseEnd: 16 * 60, // 4:00 PM = 960 minutes
  },
  EVENING: {
    baseStart: 16 * 60, // 4:00 PM = 960 minutes
    baseEnd: 19 * 60, // 7:00 PM = 1140 minutes
  },
} as const;

const INCREMENT_MINUTES = 45;

// Convert minutes from midnight to "HH:MM" format
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Convert "HH:MM" to minutes from midnight
function timeStringToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

// Format "08:00" to "8:00 AM"
export function formatTime(time: string): string {
  const [hoursStr, minsStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const mins = minsStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${mins} ${ampm}`;
}

// Get the adjusted start time for a slot based on which adjacent slots are enabled
export function getSlotStartTime(
  timeOfDay: TimeOfDay,
  enabledSlots: TimeOfDay[]
): number {
  const config = TIME_SLOT_CONFIG[timeOfDay];

  if (timeOfDay === "MORNING") {
    // Morning always starts at base time
    return config.baseStart;
  }

  if (timeOfDay === "AFTERNOON") {
    // If morning is enabled, start 45 min after morning's last slot
    if (enabledSlots.includes("MORNING")) {
      // Morning's last slot is at 11:45, so afternoon starts at 12:30
      return 12 * 60 + 30; // 12:30
    }
    return config.baseStart; // 12:00
  }

  if (timeOfDay === "EVENING") {
    // Calculate based on what afternoon ends at
    if (enabledSlots.includes("AFTERNOON")) {
      // Need to determine afternoon's last slot time
      const afternoonStart = enabledSlots.includes("MORNING")
        ? 12 * 60 + 30 // 12:30 if morning enabled
        : 12 * 60; // 12:00 if morning not enabled

      // Calculate afternoon's last slot
      const afternoonEnd = TIME_SLOT_CONFIG.AFTERNOON.baseEnd;
      let lastAfternoonSlot = afternoonStart;
      while (lastAfternoonSlot + INCREMENT_MINUTES <= afternoonEnd) {
        lastAfternoonSlot += INCREMENT_MINUTES;
      }
      // Go back one step to get actual last slot
      lastAfternoonSlot -= INCREMENT_MINUTES;
      if (lastAfternoonSlot < afternoonStart) {
        lastAfternoonSlot = afternoonStart;
      }

      // Actually, let's recalculate properly
      // Generate all afternoon slots and get the last one
      const slots: number[] = [];
      let current = afternoonStart;
      while (current + INCREMENT_MINUTES <= afternoonEnd) {
        slots.push(current);
        current += INCREMENT_MINUTES;
      }

      if (slots.length > 0) {
        return slots[slots.length - 1] + INCREMENT_MINUTES;
      }
    }
    return config.baseStart; // 16:00 (4:00 PM)
  }

  return config.baseStart;
}

// Generate all 45-minute increment times for a slot
export function generateTimeSlots(
  timeOfDay: TimeOfDay,
  enabledSlots: TimeOfDay[]
): string[] {
  const startMinutes = getSlotStartTime(timeOfDay, enabledSlots);
  const endMinutes = TIME_SLOT_CONFIG[timeOfDay].baseEnd;

  const slots: string[] = [];
  let current = startMinutes;

  // Generate slots that fit within the time window
  // A slot is valid if it starts before the end time (leaving room for the appointment)
  while (current + INCREMENT_MINUTES <= endMinutes) {
    slots.push(minutesToTimeString(current));
    current += INCREMENT_MINUTES;
  }

  return slots;
}

// Get all enabled slots for a date from the available dates
export function getEnabledSlotsForDate(
  availableDates: Array<{ timeOfDay: TimeOfDay }>
): TimeOfDay[] {
  return availableDates.map((d) => d.timeOfDay);
}

// Calculate all available times for a date, excluding booked and disabled times
export function getAvailableTimes(
  timeOfDay: TimeOfDay,
  enabledSlots: TimeOfDay[],
  bookedTimes: string[],
  disabledTimes: string[]
): string[] {
  const allSlots = generateTimeSlots(timeOfDay, enabledSlots);
  const unavailable = new Set([...bookedTimes, ...disabledTimes]);
  return allSlots.filter((slot) => !unavailable.has(slot));
}
