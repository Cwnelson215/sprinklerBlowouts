"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface DayRenderInfo {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  isPast: boolean;
}

interface CalendarProps {
  selectedDate?: Date | null;
  onSelectDate?: (date: Date) => void;
  renderDay?: (info: DayRenderInfo) => React.ReactNode;
  isDayDisabled?: (date: Date) => boolean;
  isDayAvailable?: (date: Date) => boolean;
  className?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar({
  selectedDate,
  onSelectDate,
  renderDay,
  isDayDisabled,
  isDayAvailable,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date());
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = startOfDay(new Date());

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className={cn("w-full", className)}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goToPreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const dayIsToday = isToday(day);
          const isPast = isBefore(day, today);
          const disabled = isDayDisabled?.(day) ?? false;
          const available = isDayAvailable?.(day) ?? true;

          const info: DayRenderInfo = {
            date: day,
            isSelected: selected,
            isToday: dayIsToday,
            isCurrentMonth,
            isPast,
          };

          const handleClick = () => {
            if (!disabled && onSelectDate) {
              onSelectDate(day);
            }
          };

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={handleClick}
              disabled={disabled || !isCurrentMonth}
              className={cn(
                "relative h-12 w-full rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
                // Base styles
                "flex flex-col items-center justify-center",
                // Current month vs other months
                isCurrentMonth ? "text-gray-900" : "text-gray-300",
                // Today indicator
                dayIsToday && !selected && "bg-brand-50 border border-brand-500",
                // Selected state
                selected && "bg-brand-600 text-white",
                // Available but not selected
                available && !selected && isCurrentMonth && !isPast && "hover:bg-brand-100",
                // Unavailable/disabled
                (disabled || isPast || !available) &&
                  isCurrentMonth &&
                  !selected &&
                  "bg-gray-100 text-gray-400 cursor-not-allowed",
                // Non-current month
                !isCurrentMonth && "cursor-default"
              )}
            >
              <span className="font-medium">{format(day, "d")}</span>
              {renderDay && isCurrentMonth && (
                <div className="absolute bottom-0.5 left-0 right-0">
                  {renderDay(info)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
