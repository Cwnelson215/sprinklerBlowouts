"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Zone {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMi: number;
  isActive: boolean;
  _count: { bookings: number; availableDates: number };
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    centerLat: "",
    centerLng: "",
    radiusMi: "15",
  });
  const router = useRouter();

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await fetch("/api/admin/zones");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setZones(data);
    } catch (err) {
      console.error("Error fetching zones:", err);
    } finally {
      setLoading(false);
    }
  };

  const createZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          centerLat: parseFloat(formData.centerLat),
          centerLng: parseFloat(formData.centerLng),
          radiusMi: parseFloat(formData.radiusMi),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: "", centerLat: "", centerLng: "", radiusMi: "15" });
        fetchZones();
      }
    } catch (err) {
      console.error("Error creating zone:", err);
    }
  };

  const toggleZone = async (id: string, isActive: boolean) => {
    try {
      await fetch("/api/admin/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      fetchZones();
    } catch (err) {
      console.error("Error toggling zone:", err);
    }
  };

  const deleteZone = async (id: string) => {
    if (!confirm("Delete this zone? This will also delete associated availability dates.")) return;
    try {
      await fetch(`/api/admin/zones?id=${id}`, { method: "DELETE" });
      fetchZones();
    } catch (err) {
      console.error("Error deleting zone:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Service Zones</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Zone"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">New Zone</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={createZone} className="space-y-4">
              <Input
                label="Zone Name"
                id="zoneName"
                placeholder="Denver Metro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Center Latitude"
                  id="centerLat"
                  type="number"
                  step="any"
                  placeholder="39.7392"
                  value={formData.centerLat}
                  onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })}
                />
                <Input
                  label="Center Longitude"
                  id="centerLng"
                  type="number"
                  step="any"
                  placeholder="-104.9903"
                  value={formData.centerLng}
                  onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })}
                />
                <Input
                  label="Radius (miles)"
                  id="radiusMi"
                  type="number"
                  step="any"
                  placeholder="15"
                  value={formData.radiusMi}
                  onChange={(e) => setFormData({ ...formData, radiusMi: e.target.value })}
                />
              </div>
              <Button type="submit">Create Zone</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500">Loading zones...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{zone.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      ({zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)})
                    </p>
                    <p className="text-sm text-gray-500">
                      Radius: {zone.radiusMi} mi
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      zone.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {zone.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-gray-500">
                  <span>{zone._count.bookings} bookings</span>
                  <span>{zone._count.availableDates} dates</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleZone(zone.id, zone.isActive)}
                  >
                    {zone.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteZone(zone.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {zones.length === 0 && (
            <p className="text-gray-400">No zones configured yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
