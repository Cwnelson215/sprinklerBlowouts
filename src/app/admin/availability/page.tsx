"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AvailabilityCalendar } from "@/components/admin/availability-calendar";
import { DaySlotEditor } from "@/components/admin/day-slot-editor";

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

export default function AdminAvailabilityPage() {
  const [dates, setDates] = useState<AvailableDate[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [datesRes, zonesRes] = await Promise.all([
        fetch("/api/admin/availability"),
        fetch("/api/admin/zones"),
      ]);

      if (datesRes.status === 401 || zonesRes.status === 401) {
        router.push("/admin/login");
        return;
      }

      setDates(await datesRes.json());
      setZones(await zonesRes.json());
    } catch (err) {
      console.error("Error fetching availability:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarDateSelect = (date: Date) => {
    setSelectedCalendarDate(date);
  };

  const handleCloseEditor = () => {
    setSelectedCalendarDate(null);
  };

  const deleteDate = async (id: string) => {
    if (!confirm("Delete this available date?")) return;
    try {
      await fetch(`/api/admin/availability?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Error deleting date:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Available Dates</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar view */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Calendar View</h2>
            <p className="text-sm text-gray-500">Click a date to manage availability</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <AvailabilityCalendar
                availableDates={dates}
                onSelectDate={handleCalendarDateSelect}
                selectedDate={selectedCalendarDate}
              />
            )}
          </CardContent>
        </Card>

        {/* Day Slot Editor */}
        {selectedCalendarDate && zones.length > 0 && (
          <DaySlotEditor
            selectedDate={selectedCalendarDate}
            allDates={dates}
            zones={zones}
            onClose={handleCloseEditor}
            onRefresh={fetchData}
          />
        )}
      </div>

      {/* Table view */}
      {!loading && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">All Available Dates</h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Zone</th>
                    <th className="pb-2 pr-4">Booked / Max</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {new Date(d.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 pr-4">{d.timeOfDay}</td>
                      <td className="py-2 pr-4">{d.zone.name}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            d._count.bookings >= d.maxBookings
                              ? "text-red-600 font-medium"
                              : ""
                          }
                        >
                          {d._count.bookings} / {d.maxBookings}
                        </span>
                      </td>
                      <td className="py-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteDate(d.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {dates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-400">
                        No available dates configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
