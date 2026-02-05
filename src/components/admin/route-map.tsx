"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for webpack
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface RouteBooking {
  id: string;
  jobNumber: string;
  customerName: string;
  address: string;
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

  // Sort by route order for polyline
  const sorted = [...geocodedBookings].sort(
    (a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999)
  );

  const polylinePositions: [number, number][] = sorted.map((b) => [
    b.lat,
    b.lng,
  ]);

  return (
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
      {geocodedBookings.map((b) => (
        <Marker key={b.id} position={[b.lat, b.lng]} icon={defaultIcon}>
          <Popup>
            <div>
              <strong>
                #{b.routeOrder !== null ? b.routeOrder + 1 : "?"} - {b.jobNumber}
              </strong>
              <br />
              {b.customerName}
              <br />
              {b.address}
            </div>
          </Popup>
        </Marker>
      ))}
      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} color="#16a34a" weight={3} />
      )}
    </MapContainer>
  );
}
