"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface AvailableDate {
  id: string;
  date: string;
  timeOfDay: string;
  maxBookings: number;
  zone: { name: string };
  _count: { bookings: number };
}

interface Zone {
  id: string;
  name: string;
}

const timeOptions = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
];

export default function AdminAvailabilityPage() {
  const [dates, setDates] = useState<AvailableDate[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    zoneId: "",
    date: "",
    timeOfDay: "MORNING",
    maxBookings: "20",
  });
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
      const zonesData = await zonesRes.json();
      setZones(zonesData);
      if (zonesData.length > 0 && !formData.zoneId) {
        setFormData((f) => ({ ...f, zoneId: zonesData[0].id }));
      }
    } catch (err) {
      console.error("Error fetching availability:", err);
    } finally {
      setLoading(false);
    }
  };

  const createDate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: formData.zoneId,
          date: formData.date,
          timeOfDay: formData.timeOfDay,
          maxBookings: parseInt(formData.maxBookings),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error creating date:", err);
    }
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

  const zoneOptions = zones.map((z) => ({ value: z.id, label: z.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Available Dates</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Date"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">New Available Date</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={createDate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {zoneOptions.length > 0 && (
                  <Select
                    label="Zone"
                    id="zoneId"
                    options={zoneOptions}
                    value={formData.zoneId}
                    onChange={(e) =>
                      setFormData({ ...formData, zoneId: e.target.value })
                    }
                  />
                )}
                <Input
                  label="Date"
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
                <Select
                  label="Time of Day"
                  id="timeOfDay"
                  options={timeOptions}
                  value={formData.timeOfDay}
                  onChange={(e) =>
                    setFormData({ ...formData, timeOfDay: e.target.value })
                  }
                />
                <Input
                  label="Max Bookings"
                  id="maxBookings"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxBookings}
                  onChange={(e) =>
                    setFormData({ ...formData, maxBookings: e.target.value })
                  }
                />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <Card>
          <CardContent className="pt-4">
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
