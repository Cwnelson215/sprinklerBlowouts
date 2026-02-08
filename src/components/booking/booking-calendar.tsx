"use client";

import { useMemo } from "react";
import { parseISO, isSameDay, startOfDay, isBefore } from "date-fns";
import { Calendar, DayRenderInfo } from "@/components/ui/calendar";

interface AvailableDate {
  id: string;
  date: string;
  dayOfWeek: string;
  spotsRemaining: number;
}

interface BookingCalendarProps {
  availableDates: AvailableDate[];
  selectedDateId: string | null;
  onSelectDate: (dateId: string) => void;
}

export function BookingCalendar({
  availableDates,
  selectedDateId,
  onSelectDate,
}: BookingCalendarProps) {
  const today = startOfDay(new Date());

  // Create a map for quick lookup of available dates
  const availableDateMap = useMemo(() => {
    const map = new Map<string, AvailableDate>();
    availableDates.forEach((ad) => {
      // Use ISO date string as key for lookup
      const dateKey = ad.date;
      map.set(dateKey, ad);
    });
    return map;
  }, [availableDates]);

  // Find the selected date object
  const selectedAvailableDate = availableDates.find(
    (d) => d.id === selectedDateId
  );
  const selectedDate = selectedAvailableDate
    ? parseISO(selectedAvailableDate.date + "T12:00:00")
    : null;

  const getAvailableDateForDay = (date: Date): AvailableDate | undefined => {
    // Format as YYYY-MM-DD to match the API format
    const dateStr = date.toISOString().split("T")[0];
    return availableDateMap.get(dateStr);
  };

  const isDayDisabled = (date: Date): boolean => {
    // Disable past dates
    if (isBefore(date, today)) return true;
    // Disable dates that aren't available
    return !getAvailableDateForDay(date);
  };

  const isDayAvailable = (date: Date): boolean => {
    const availableDate = getAvailableDateForDay(date);
    return !!availableDate && availableDate.spotsRemaining > 0;
  };

  const handleSelectDate = (date: Date) => {
    const availableDate = getAvailableDateForDay(date);
    if (availableDate) {
      onSelectDate(availableDate.id);
    }
  };

  const renderDay = (info: DayRenderInfo) => {
    if (!info.isCurrentMonth || info.isPast) return null;

    const availableDate = getAvailableDateForDay(info.date);
    if (!availableDate) return null;

    const spots = availableDate.spotsRemaining;

    return (
      <span
        className={`text-[10px] leading-none ${
          info.isSelected
            ? "text-white/90"
            : spots <= 3
            ? "text-amber-600"
            : "text-gray-500"
        }`}
      >
        {spots} {spots === 1 ? "spot" : "spots"}
      </span>
    );
  };

  return (
    <Calendar
      selectedDate={selectedDate}
      onSelectDate={handleSelectDate}
      isDayDisabled={isDayDisabled}
      isDayAvailable={isDayAvailable}
      renderDay={renderDay}
    />
  );
}
