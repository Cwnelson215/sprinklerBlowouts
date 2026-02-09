"use client";

import { formatTime } from "@/lib/time-slots";

interface TimeGridProps {
  availableTimes: string[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

export function TimeGrid({
  availableTimes,
  selectedTime,
  onSelectTime,
}: TimeGridProps) {
  if (availableTimes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No available times for this date. Please select a different date.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {availableTimes.map((time) => {
        const isSelected = selectedTime === time;
        return (
          <button
            key={time}
            type="button"
            onClick={() => onSelectTime(time)}
            className={`
              px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${
                isSelected
                  ? "bg-brand-600 text-white ring-2 ring-brand-600 ring-offset-2"
                  : "bg-white border border-gray-300 text-gray-700 hover:border-brand-500 hover:bg-brand-50"
              }
            `}
          >
            {formatTime(time)}
          </button>
        );
      })}
    </div>
  );
}
