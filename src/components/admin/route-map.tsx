"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOsrmRoute } from "@/lib/use-osrm-route";

function createNumberedIcon(num: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      background-color: #16a34a;
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

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
}

interface RouteMapProps {
  bookings: RouteBooking[];
}

export default function RouteMap({ bookings }: RouteMapProps) {
  const geocodedBookings = bookings.filter(
    (b): b is RouteBooking & { lat: number; lng: number } =>
      b.lat !== null && b.lng !== null
  );

  // Sort by route order for polyline
  const sorted = [...geocodedBookings].sort(
    (a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999)
  );

  const { coordinates, loading, isFallback } = useOsrmRoute(
    sorted.map((b) => ({ lat: b.lat, lng: b.lng }))
  );

  if (geocodedBookings.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
        No geocoded locations to display
      </div>
    );
  }

  // Calculate center
  const avgLat =
    geocodedBookings.reduce((sum, b) => sum + b.lat, 0) /
    geocodedBookings.length;
  const avgLng =
    geocodedBookings.reduce((sum, b) => sum + b.lng, 0) /
    geocodedBookings.length;

  return (
    <div className="relative">
      {loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] rounded bg-white/90 px-3 py-1 text-xs text-gray-600 shadow">
          Loading road directions...
        </div>
      )}
      <MapContainer
        center={[avgLat, avgLng]}
        zoom={12}
        style={{ height: "384px", width: "100%" }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geocodedBookings.map((b) => {
          const stopNum = b.routeOrder !== null ? b.routeOrder + 1 : 0;
          const fullAddress = [b.address, b.city, b.state, b.zip]
            .filter(Boolean)
            .join(", ");
          return (
            <Marker
              key={b.id}
              position={[b.lat, b.lng]}
              icon={createNumberedIcon(stopNum || 0)}
            >
              <Popup>
                <div>
                  <strong>
                    #{stopNum || "?"} - {b.jobNumber}
                  </strong>
                  <br />
                  {b.customerName}
                  <br />
                  {fullAddress}
                </div>
              </Popup>
            </Marker>
          );
        })}
        {coordinates.length > 1 && (
          <Polyline
            positions={coordinates}
            color="#16a34a"
            weight={3}
            dashArray={isFallback ? "8 8" : undefined}
          />
        )}
      </MapContainer>
    </div>
  );
}
