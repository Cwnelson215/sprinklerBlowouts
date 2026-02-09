interface RouteStop {
  lat: number;
  lng: number;
  customerName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  routeOrder: number | null;
}

/**
 * Builds a Google Maps directions URL with all stops in route order.
 * Google Maps supports up to ~25 waypoints in a URL.
 */
export function generateGoogleMapsUrl(stops: RouteStop[]): string {
  const sorted = [...stops].sort(
    (a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999)
  );
  const waypoints = sorted.map((s) => `${s.lat},${s.lng}`).join("/");
  return `https://www.google.com/maps/dir/${waypoints}`;
}

/**
 * Generates a GPX XML string with waypoints and a route element.
 */
export function generateGpxString(routeName: string, stops: RouteStop[]): string {
  const sorted = [...stops].sort(
    (a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999)
  );

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const waypoints = sorted
    .map((s, i) => {
      const name = `${i + 1}. ${s.customerName}`;
      const fullAddress = [s.address, s.city, s.state, s.zip]
        .filter(Boolean)
        .join(", ");
      return `  <wpt lat="${s.lat}" lon="${s.lng}">
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(fullAddress)}</desc>
  </wpt>`;
    })
    .join("\n");

  const routePoints = sorted
    .map((s, i) => {
      const name = `${i + 1}. ${s.customerName}`;
      return `    <rtept lat="${s.lat}" lon="${s.lng}">
      <name>${escapeXml(name)}</name>
    </rtept>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SprinklerBlowouts"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(routeName)}</name>
  </metadata>
${waypoints}
  <rte>
    <name>${escapeXml(routeName)}</name>
${routePoints}
  </rte>
</gpx>`;
}

/**
 * Triggers a browser file download.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
