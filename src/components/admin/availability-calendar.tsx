"use client";

import { useMemo } from "react";
import { parseISO, isSameDay, format, startOfDay, isBefore } from "date-fns";
import { Calendar, DayRenderInfo } from "@/components/ui/calendar";

interface AvailableDate {
  id: string;
  date: string;
  timeOfDay: string;
  maxBookings: number;
  zone: { name: string };
  _count: { bookings: number };
}

interface AvailabilityCalendarProps {
  availableDates: AvailableDate[];
  onSelectDate: (date: Date) => void;
  selectedDate?: Date | null;
}

export function AvailabilityCalendar({
  availableDates,
  onSelectDate,
  selectedDate,
}: AvailabilityCalendarProps) {
  const today = startOfDay(new Date());

  // Group availability by date for display
  const dateInfoMap = useMemo(() => {
    const map = new Map<
      string,
      { totalBookings: number; totalMax: number; slots: AvailableDate[] }
    >();

    availableDates.forEach((ad) => {
      const dateKey = ad.date.split("T")[0];
      const existing = map.get(dateKey);
      if (existing) {
        existing.totalBookings += ad._count.bookings;
        existing.totalMax += ad.maxBookings;
        existing.slots.push(ad);
      } else {
        map.set(dateKey, {
          totalBookings: ad._count.bookings,
          totalMax: ad.maxBookings,
          slots: [ad],
        });
      }
    });

    return map;
  }, [availableDates]);

  const getDateInfo = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return dateInfoMap.get(dateStr);
  };

  const isDayAvailable = (date: Date): boolean => {
    return !!getDateInfo(date);
  };

  const renderDay = (info: DayRenderInfo) => {
    if (!info.isCurrentMonth) return null;

    const dateInfo = getDateInfo(info.date);
    if (!dateInfo) return null;

    const { totalBookings, totalMax } = dateInfo;
    const isFull = totalBookings >= totalMax;

    return (
      <span
        className={`text-[10px] leading-none ${
          info.isSelected
            ? "text-white/90"
            : isFull
            ? "text-red-600"
            : totalBookings > 0
            ? "text-amber-600"
            : "text-green-600"
        }`}
      >
        {totalBookings}/{totalMax}
      </span>
    );
  };

  return (
    <div>
      <Calendar
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        isDayAvailable={isDayAvailable}
        renderDay={renderDay}
      />
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-100 border border-green-300" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-300" />
          <span>Partially booked</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-300" />
          <span>Full</span>
        </div>
      </div>
    </div>
  );
}
