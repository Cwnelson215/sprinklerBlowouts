import { haversineDistance } from "./utils";

interface RoutePoint {
  id: string;
  lat: number;
  lng: number;
}

interface OptimizedRoute {
  order: string[];
  totalDistance: number;
}

/**
 * Nearest-neighbor heuristic + 2-opt improvement for route optimization.
 * Works well for clusters of 10-20 stops.
 *
 * When a depot is provided, the route starts from the depot location.
 * The depot is NOT included in the returned order (only booking IDs),
 * but depot-to-first-stop distance is included in totalDistance.
 */
export function optimizeRoute(
  points: RoutePoint[],
  depot?: { lat: number; lng: number }
): OptimizedRoute {
  if (points.length === 0) {
    return { order: [], totalDistance: 0 };
  }

  if (points.length === 1) {
    const depotDist = depot
      ? haversineDistance(depot.lat, depot.lng, points[0].lat, points[0].lng)
      : 0;
    return {
      order: [points[0].id],
      totalDistance: Math.round(depotDist * 100) / 100,
    };
  }

  if (!depot) {
    // Original behavior: try all start points
    return optimizeWithoutDepot(points);
  }

  // With depot: prepend depot as index 0 in the distance matrix
  const allPoints = [
    { id: "__depot__", lat: depot.lat, lng: depot.lng },
    ...points,
  ];

  // Build distance matrix
  const dist: number[][] = [];
  for (let i = 0; i < allPoints.length; i++) {
    dist[i] = [];
    for (let j = 0; j < allPoints.length; j++) {
      dist[i][j] =
        i === j
          ? 0
          : haversineDistance(
              allPoints[i].lat,
              allPoints[i].lng,
              allPoints[j].lat,
              allPoints[j].lng
            );
    }
  }

  // Nearest-neighbor starting from depot (index 0) only
  let bestRoute = nearestNeighbor(dist, 0);
  let bestDist = routeDistance(bestRoute, dist);

  // 2-opt improvement keeping depot (index 0) fixed
  bestRoute = twoOptFixed(bestRoute, dist);
  bestDist = routeDistance(bestRoute, dist);

  // Remove depot from the order, return only booking IDs
  const orderWithoutDepot = bestRoute
    .filter((i) => i !== 0)
    .map((i) => allPoints[i].id);

  return {
    order: orderWithoutDepot,
    totalDistance: Math.round(bestDist * 100) / 100,
  };
}

function optimizeWithoutDepot(points: RoutePoint[]): OptimizedRoute {
  if (points.length === 2) {
    return {
      order: points.map((p) => p.id),
      totalDistance: haversineDistance(
        points[0].lat,
        points[0].lng,
        points[1].lat,
        points[1].lng
      ),
    };
  }

  // Build distance matrix
  const dist: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    dist[i] = [];
    for (let j = 0; j < points.length; j++) {
      dist[i][j] =
        i === j
          ? 0
          : haversineDistance(
              points[i].lat,
              points[i].lng,
              points[j].lat,
              points[j].lng
            );
    }
  }

  // Nearest-neighbor starting from each point, keep best
  let bestRoute = nearestNeighbor(dist, 0);
  let bestDist = routeDistance(bestRoute, dist);

  for (let start = 1; start < points.length; start++) {
    const route = nearestNeighbor(dist, start);
    const d = routeDistance(route, dist);
    if (d < bestDist) {
      bestRoute = route;
      bestDist = d;
    }
  }

  // 2-opt improvement
  bestRoute = twoOpt(bestRoute, dist);
  bestDist = routeDistance(bestRoute, dist);

  return {
    order: bestRoute.map((i) => points[i].id),
    totalDistance: Math.round(bestDist * 100) / 100,
  };
}

function nearestNeighbor(dist: number[][], start: number): number[] {
  const n = dist.length;
  const visited = new Set<number>([start]);
  const route = [start];

  while (route.length < n) {
    const current = route[route.length - 1];
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && dist[current][i] < nearestDist) {
        nearest = i;
        nearestDist = dist[current][i];
      }
    }

    route.push(nearest);
    visited.add(nearest);
  }

  return route;
}

function twoOpt(route: number[], dist: number[][]): number[] {
  const n = route.length;
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const d1 = dist[route[i]][route[i + 1]] + dist[route[j]][route[(j + 1) % n]];
        const d2 = dist[route[i]][route[j]] + dist[route[i + 1]][route[(j + 1) % n]];

        if (d2 < d1 - 1e-10) {
          // Reverse the segment between i+1 and j
          const newRoute = [...route];
          let left = i + 1;
          let right = j;
          while (left < right) {
            [newRoute[left], newRoute[right]] = [newRoute[right], newRoute[left]];
            left++;
            right--;
          }
          route = newRoute;
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * 2-opt improvement that keeps the first element (depot at index 0) fixed.
 * Only swaps segments starting from index 1 onward.
 */
function twoOptFixed(route: number[], dist: number[][]): number[] {
  const n = route.length;
  let improved = true;

  while (improved) {
    improved = false;
    // Start i from 0 so we consider the edge depot->first stop,
    // but only reverse segments from i+1 onward (never moving index 0)
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const nextJ = (j + 1) % n;
        // For open path (no return to depot), skip if j is the last element
        if (nextJ === 0) continue;

        const d1 = dist[route[i]][route[i + 1]] + dist[route[j]][route[nextJ]];
        const d2 = dist[route[i]][route[j]] + dist[route[i + 1]][route[nextJ]];

        if (d2 < d1 - 1e-10) {
          const newRoute = [...route];
          let left = i + 1;
          let right = j;
          while (left < right) {
            [newRoute[left], newRoute[right]] = [newRoute[right], newRoute[left]];
            left++;
            right--;
          }
          route = newRoute;
          improved = true;
        }
      }
    }
  }

  return route;
}

function routeDistance(route: number[], dist: number[][]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += dist[route[i]][route[i + 1]];
  }
  return total;
}
