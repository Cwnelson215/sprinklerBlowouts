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
 */
export function optimizeRoute(points: RoutePoint[]): OptimizedRoute {
  if (points.length <= 1) {
    return {
      order: points.map((p) => p.id),
      totalDistance: 0,
    };
  }

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

function routeDistance(route: number[], dist: number[][]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += dist[route[i]][route[i + 1]];
  }
  return total;
}
