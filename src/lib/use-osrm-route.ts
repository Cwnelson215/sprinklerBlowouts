"use client";

import { useEffect, useState } from "react";

interface Coordinate {
  lat: number;
  lng: number;
}

interface OsrmRouteResult {
  /** Road-following coordinates for a Leaflet Polyline */
  coordinates: [number, number][];
  /** Whether we're still fetching */
  loading: boolean;
  /** True if OSRM failed and coordinates are straight-line fallback */
  isFallback: boolean;
}

/**
 * Calls the free OSRM public demo API to get road-following geometry
 * between an ordered list of stops. Falls back to straight lines on failure.
 */
export function useOsrmRoute(stops: Coordinate[]): OsrmRouteResult {
  const [coordinates, setCoordinates] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (stops.length < 2) {
      setCoordinates(stops.map((s) => [s.lat, s.lng]));
      setIsFallback(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const coordString = stops
      .map((s) => `${s.lng},${s.lat}`)
      .join(";");

    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
          // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setCoordinates(coords);
          setIsFallback(false);
        } else {
          throw new Error("No route in OSRM response");
        }
      })
      .catch(() => {
        // Fallback to straight lines
        setCoordinates(stops.map((s) => [s.lat, s.lng]));
        setIsFallback(true);
      })
      .finally(() => {
        setLoading(false);
        clearTimeout(timeoutId);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [JSON.stringify(stops)]);

  return { coordinates, loading, isFallback };
}
