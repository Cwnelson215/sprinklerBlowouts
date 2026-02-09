"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlotToggle } from "./slot-toggle";
import { TimeIncrementToggle } from "./time-increment-toggle";

interface AvailableDate {
  id: string;
  date: string;
  timeOfDay: string;
  maxBookings: number;
  zoneId: string;
  zone: { name: string };
  _count: { bookings: number };
  disabledTimes: string[];
  bookedTimes: string[];
  allTimeSlots: string[];
}

interface Zone {
  id: string;
  name: string;
}

interface DaySlotEditorProps {
  selectedDate: Date;
  allDates: AvailableDate[];
  zones: Zone[];
  onClose: () => void;
  onRefresh: () => void;
}

const TIME_SLOTS = ["MORNING", "AFTERNOON", "EVENING"] as const;

export function DaySlotEditor({
  selectedDate,
  allDates,
  zones,
  onClose,
  onRefresh,
}: DaySlotEditorProps) {
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id || "");

  const dateString = format(selectedDate, "yyyy-MM-dd");

  // Find existing slots for this date and zone
  const slotsForDate = useMemo(() => {
    return allDates.filter((d) => {
      const dDateStr = format(new Date(d.date), "yyyy-MM-dd");
      return dDateStr === dateString && d.zoneId === selectedZoneId;
    });
  }, [allDates, dateString, selectedZoneId]);

  const getSlotData = (timeOfDay: string) => {
    const slot = slotsForDate.find((s) => s.timeOfDay === timeOfDay);
    return {
      enabled: !!slot,
      slotId: slot?.id || null,
      maxBookings: slot?.maxBookings || 20,
      currentBookings: slot?._count.bookings || 0,
      disabledTimes: slot?.disabledTimes || [],
      bookedTimes: slot?.bookedTimes || [],
      allTimeSlots: slot?.allTimeSlots || [],
    };
  };

  // State to track which time slot is expanded
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  const handleToggle = async (timeOfDay: string, enabled: boolean) => {
    if (enabled) {
      // Create new slot
      const res = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: selectedZoneId,
          date: dateString,
          timeOfDay,
          maxBookings: 20,
        }),
      });
      if (res.ok) {
        onRefresh();
      }
    } else {
      // Delete slot
      const slotData = getSlotData(timeOfDay);
      if (slotData.slotId) {
        if (slotData.currentBookings > 0) {
          const confirmed = confirm(
            `This slot has ${slotData.currentBookings} booking(s). Deleting will set them to "AWAITING_SCHEDULE". Continue?`
          );
          if (!confirmed) return;
        }
        const res = await fetch(`/api/admin/availability?id=${slotData.slotId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          onRefresh();
        }
      }
    }
  };

  const handleMaxBookingsChange = async (timeOfDay: string, maxBookings: number) => {
    const slotData = getSlotData(timeOfDay);
    if (slotData.slotId) {
      const res = await fetch(`/api/admin/availability?id=${slotData.slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxBookings }),
      });
      if (res.ok) {
        onRefresh();
      }
    }
  };

  const handleTimeToggle = async (timeOfDay: string, time: string, enabled: boolean) => {
    const slotData = getSlotData(timeOfDay);
    if (!slotData.slotId) return;

    // Calculate new disabled times
    let newDisabledTimes: string[];
    if (enabled) {
      // Remove from disabled times
      newDisabledTimes = slotData.disabledTimes.filter((t) => t !== time);
    } else {
      // Add to disabled times
      newDisabledTimes = [...slotData.disabledTimes, time];
    }

    const res = await fetch(`/api/admin/availability?id=${slotData.slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabledTimes: newDisabledTimes }),
    });
    if (res.ok) {
      onRefresh();
    }
  };

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.name }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {zones.length > 1 && (
          <Select
            label="Zone"
            id="zone-select"
            options={zoneOptions}
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
          />
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Time Slots</h3>
          <div className="space-y-2">
            {TIME_SLOTS.map((timeOfDay) => {
              const slotData = getSlotData(timeOfDay);
              const isExpanded = expandedSlot === timeOfDay;

              return (
                <div key={timeOfDay} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <SlotToggle
                        timeOfDay={timeOfDay}
                        enabled={slotData.enabled}
                        maxBookings={slotData.maxBookings}
                        currentBookings={slotData.currentBookings}
                        slotId={slotData.slotId}
                        onToggle={(enabled) => handleToggle(timeOfDay, enabled)}
                        onMaxBookingsChange={(max) => handleMaxBookingsChange(timeOfDay, max)}
                      />
                    </div>
                    {slotData.enabled && slotData.allTimeSlots.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSlot(isExpanded ? null : timeOfDay)}
                        className="text-xs"
                      >
                        {isExpanded ? "Hide Times" : "Manage Times"}
                      </Button>
                    )}
                  </div>

                  {slotData.enabled && isExpanded && slotData.allTimeSlots.length > 0 && (
                    <div className="ml-4 border rounded-lg bg-white">
                      <div className="p-2 border-b bg-gray-50">
                        <p className="text-xs text-gray-500">
                          Toggle individual time slots. Booked times cannot be disabled.
                        </p>
                      </div>
                      {slotData.allTimeSlots.map((time) => (
                        <TimeIncrementToggle
                          key={time}
                          time={time}
                          isBooked={slotData.bookedTimes.includes(time)}
                          isDisabled={slotData.disabledTimes.includes(time)}
                          onToggle={(enabled) => handleTimeToggle(timeOfDay, time, enabled)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
