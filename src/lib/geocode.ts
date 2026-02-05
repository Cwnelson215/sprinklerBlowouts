export interface GeocodeResult {
  lat: number;
  lng: number;
  source: "census" | "opencage";
}

export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<GeocodeResult | null> {
  // Try US Census Bureau Geocoding API first (free, no API key)
  const censusResult = await geocodeWithCensus(address, city, state, zip);
  if (censusResult) return censusResult;

  // Fallback to OpenCage if configured
  if (process.env.OPENCAGE_API_KEY) {
    const opencageResult = await geocodeWithOpenCage(
      `${address}, ${city}, ${state} ${zip}`
    );
    if (opencageResult) return opencageResult;
  }

  return null;
}

async function geocodeWithCensus(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      street: address,
      city,
      state,
      zip,
      benchmark: "Public_AR_Current",
      format: "json",
    });

    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/address?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;

    return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      source: "census",
    };
  } catch {
    return null;
  }
}

async function geocodeWithOpenCage(
  fullAddress: string
): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      q: fullAddress,
      key: process.env.OPENCAGE_API_KEY!,
      countrycode: "us",
      limit: "1",
    });

    const res = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return null;

    return {
      lat: result.geometry.lat,
      lng: result.geometry.lng,
      source: "opencage",
    };
  } catch {
    return null;
  }
}
