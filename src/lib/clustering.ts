import { haversineDistance } from "./utils";

interface Point {
  id: string;
  lat: number;
  lng: number;
}

/**
 * DBSCAN clustering algorithm for grouping nearby addresses.
 * Groups houses by proximity so route optimization works on manageable clusters.
 *
 * @param points - Array of geocoded locations
 * @param epsilon - Maximum distance between neighbors (miles)
 * @param minPoints - Minimum points to form a cluster
 * @returns Array of clusters, each containing point IDs. Noise points get their own single-point clusters.
 */
export function dbscan(
  points: Point[],
  epsilon: number = 1.5,
  minPoints: number = 2
): string[][] {
  const labels = new Map<string, number>(); // point id -> cluster label (-1 = noise)
  let currentCluster = 0;

  function regionQuery(point: Point): Point[] {
    return points.filter(
      (other) =>
        other.id !== point.id &&
        haversineDistance(point.lat, point.lng, other.lat, other.lng) <= epsilon
    );
  }

  function expandCluster(
    point: Point,
    neighbors: Point[],
    cluster: number
  ): void {
    labels.set(point.id, cluster);
    const queue = [...neighbors];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLabel = labels.get(current.id);

      // If noise, claim it for this cluster
      if (currentLabel === -1) {
        labels.set(current.id, cluster);
      }

      // If already processed, skip
      if (currentLabel !== undefined) continue;

      labels.set(current.id, cluster);

      const currentNeighbors = regionQuery(current);
      if (currentNeighbors.length >= minPoints) {
        queue.push(...currentNeighbors);
      }
    }
  }

  // Main DBSCAN loop
  for (const point of points) {
    if (labels.has(point.id)) continue;

    const neighbors = regionQuery(point);
    if (neighbors.length < minPoints) {
      labels.set(point.id, -1); // noise
    } else {
      expandCluster(point, neighbors, currentCluster);
      currentCluster++;
    }
  }

  // Group by cluster
  const clusters = new Map<number, string[]>();
  for (const [id, label] of labels) {
    if (!clusters.has(label)) {
      clusters.set(label, []);
    }
    clusters.get(label)!.push(id);
  }

  // Noise points (-1) each become their own cluster
  const result: string[][] = [];
  for (const [label, ids] of clusters) {
    if (label === -1) {
      ids.forEach((id) => result.push([id]));
    } else {
      result.push(ids);
    }
  }

  return result;
}
