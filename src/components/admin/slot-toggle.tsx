"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface SlotToggleProps {
  timeOfDay: "MORNING" | "AFTERNOON" | "EVENING";
  enabled: boolean;
  maxBookings: number;
  currentBookings: number;
  slotId: string | null;
  onToggle: (enabled: boolean) => Promise<void>;
  onMaxBookingsChange: (maxBookings: number) => Promise<void>;
}

const timeLabels: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

export function SlotToggle({
  timeOfDay,
  enabled,
  maxBookings,
  currentBookings,
  slotId,
  onToggle,
  onMaxBookingsChange,
}: SlotToggleProps) {
  const [loading, setLoading] = useState(false);
  const [localMaxBookings, setLocalMaxBookings] = useState(maxBookings.toString());

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(!enabled);
    } finally {
      setLoading(false);
    }
  };

  const handleMaxBookingsBlur = async () => {
    const newMax = parseInt(localMaxBookings);
    if (isNaN(newMax) || newMax < 1 || newMax > 100) {
      setLocalMaxBookings(maxBookings.toString());
      return;
    }
    if (newMax === maxBookings) return;

    if (newMax < currentBookings) {
      alert(`Cannot set max bookings below current booking count (${currentBookings})`);
      setLocalMaxBookings(maxBookings.toString());
      return;
    }

    setLoading(true);
    try {
      await onMaxBookingsChange(newMax);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${enabled ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"} ${loading ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            disabled={loading}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
        </label>
        <span className="font-medium text-gray-700">{timeLabels[timeOfDay]}</span>
      </div>

      {enabled && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {currentBookings} booked
          </span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Max:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={localMaxBookings}
              onChange={(e) => setLocalMaxBookings(e.target.value)}
              onBlur={handleMaxBookingsBlur}
              disabled={loading}
              className="w-16 h-8 px-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      {loading && (
        <span className="text-sm text-gray-400 animate-pulse">Saving...</span>
      )}
    </div>
  );
}
