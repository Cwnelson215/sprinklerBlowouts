"use client";

import { formatTime } from "@/lib/time-slots";

interface TimeIncrementToggleProps {
  time: string;
  isBooked: boolean;
  isDisabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function TimeIncrementToggle({
  time,
  isBooked,
  isDisabled,
  onToggle,
}: TimeIncrementToggleProps) {
  const isEnabled = !isDisabled;

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {formatTime(time)}
        </span>
        {isBooked && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Booked
          </span>
        )}
      </div>

      {isBooked ? (
        <span className="text-xs text-gray-400">Cannot modify</span>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(!isEnabled)}
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
            ${isEnabled ? "bg-brand-600" : "bg-gray-200"}
          `}
          role="switch"
          aria-checked={isEnabled}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
              transition duration-200 ease-in-out
              ${isEnabled ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      )}
    </div>
  );
}
