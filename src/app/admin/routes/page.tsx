"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SERVICE_CONFIGS } from "@/lib/service-config";
import type { ServiceType } from "@/lib/types";
import dynamic from "next/dynamic";
import { generateGoogleMapsUrl, generateGpxString, downloadFile } from "@/lib/route-export";
import { DEPOT } from "@/lib/constants";

const RouteMap = dynamic(() => import("@/components/admin/route-map"), {
  ssr: false,
  loading: () => <div className="h-96 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">Loading map...</div>,
});

interface RouteBooking {
  id: string;
  jobNumber: string;
  customerName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number | null;
  lng: number | null;
  routeOrder: number | null;
  status: string;
}

interface RouteGroup {
  id: string;
  date: string;
  timeOfDay?: string;
  serviceType?: string;
  houseCount: number;
  estimatedDuration: number | null;
  estimatedDistance: number | null;
  zone: { name: string } | null;
  bookings: RouteBooking[];
}

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchRoutes();
  }, [serviceTypeFilter]);

  const fetchRoutes = async () => {
    try {
      const params = new URLSearchParams();
      if (serviceTypeFilter) params.set("serviceType", serviceTypeFilter);
      const res = await fetch(`/api/admin/routes?${params}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setRoutes(data);
    } catch (err) {
      console.error("Error fetching routes:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerOptimization = async () => {
    setOptimizing(true);
    try {
      await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      // Wait a bit for the job to process
      setTimeout(() => {
        fetchRoutes();
        setOptimizing(false);
      }, 3000);
    } catch (err) {
      console.error("Error triggering optimization:", err);
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Route Groups</h1>
        <div className="flex gap-4">
          <Select
            options={[
              { value: "", label: "All Services" },
              { value: "SPRINKLER_BLOWOUT", label: "Blowout" },
              { value: "BACKFLOW_TESTING", label: "Backflow" },
            ]}
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
          />
          <Button onClick={triggerOptimization} disabled={optimizing}>
            {optimizing ? "Optimizing..." : "Recalculate All Routes"}
          </Button>
        </div>
      </div>

      {selectedRoute && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedRoute.zone?.name ?? "Unknown Zone"} -{" "}
                  {new Date(selectedRoute.date).toLocaleDateString("en-US", { timeZone: "UTC" })}{selectedRoute.timeOfDay ? ` ${selectedRoute.timeOfDay}` : ""}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedRoute.houseCount} stops
                  {selectedRoute.estimatedDistance
                    ? ` | ${selectedRoute.estimatedDistance} miles`
                    : ""}
                  {selectedRoute.estimatedDuration
                    ? ` | ~${selectedRoute.estimatedDuration} min`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const geocoded = selectedRoute.bookings.filter(
                      (b) => b.lat !== null && b.lng !== null
                    ) as (RouteBooking & { lat: number; lng: number })[];
                    if (geocoded.length === 0) return;
                    window.open(generateGoogleMapsUrl(geocoded, DEPOT), "_blank");
                  }}
                >
                  Open in Google Maps
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const geocoded = selectedRoute.bookings.filter(
                      (b) => b.lat !== null && b.lng !== null
                    ) as (RouteBooking & { lat: number; lng: number })[];
                    if (geocoded.length === 0) return;
                    const routeName = `${selectedRoute.zone?.name ?? "Route"} - ${new Date(selectedRoute.date).toLocaleDateString("en-US", { timeZone: "UTC" })}`;
                    const gpx = generateGpxString(routeName, geocoded, DEPOT);
                    downloadFile(gpx, `${routeName}.gpx`, "application/gpx+xml");
                  }}
                >
                  Export GPX
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedRoute(null)}>
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RouteMap bookings={selectedRoute.bookings} depot={{ lat: DEPOT.lat, lng: DEPOT.lng, address: `${DEPOT.address}, ${DEPOT.city}, ${DEPOT.state} ${DEPOT.zip}` }} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Job #</th>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Address</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRoute.bookings.map((b, i) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{b.routeOrder ?? i + 1}</td>
                      <td className="py-2 pr-4 font-mono">{b.jobNumber}</td>
                      <td className="py-2 pr-4">{b.customerName}</td>
                      <td className="py-2 pr-4">{b.address}</td>
                      <td className="py-2">
                        <Badge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500">Loading routes...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => (
            <Card
              key={route.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedRoute(route)}
            >
              <CardContent className="pt-4">
                <h3 className="font-semibold">{route.zone?.name ?? "Unknown Zone"}</h3>
                <p className="text-sm text-gray-600">
                  {new Date(route.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                  {route.timeOfDay && ` - ${route.timeOfDay}`}
                </p>
                {route.serviceType && (
                  <p className="text-xs text-gray-500">
                    {SERVICE_CONFIGS[route.serviceType as ServiceType]?.shortLabel || route.serviceType}
                  </p>
                )}
                <div className="mt-2 flex gap-4 text-sm text-gray-500">
                  <span>{route.houseCount} stops</span>
                  {route.estimatedDistance && (
                    <span>{route.estimatedDistance} mi</span>
                  )}
                  {route.estimatedDuration && (
                    <span>~{route.estimatedDuration} min</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {routes.length === 0 && (
            <p className="text-gray-400">No route groups yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
