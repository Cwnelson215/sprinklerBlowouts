import { haversineDistance } from "./utils";

interface Point {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Calculate the centroid (average lat/lng) of a cluster.
 */
function calculateCentroid(cluster: Point[]): { lat: number; lng: number } {
  const sumLat = cluster.reduce((sum, p) => sum + p.lat, 0);
  const sumLng = cluster.reduce((sum, p) => sum + p.lng, 0);
  return {
    lat: sumLat / cluster.length,
    lng: sumLng / cluster.length,
  };
}

/**
 * Find the point farthest from the centroid and return both the point and distance.
 */
function getMaxDistanceFromCentroid(
  cluster: Point[],
  centroid: { lat: number; lng: number }
): { point: Point; distance: number } {
  let maxDistance = 0;
  let farthestPoint = cluster[0];

  for (const point of cluster) {
    const dist = haversineDistance(centroid.lat, centroid.lng, point.lat, point.lng);
    if (dist > maxDistance) {
      maxDistance = dist;
      farthestPoint = point;
    }
  }

  return { point: farthestPoint, distance: maxDistance };
}

/**
 * Bisect a cluster using a plane perpendicular to the centroid-farthest vector.
 * Points are split based on which side of the midpoint they fall on.
 */
function bisectCluster(
  cluster: Point[],
  centroid: { lat: number; lng: number },
  farthestPoint: Point
): [Point[], Point[]] {
  // Calculate the direction vector from centroid to farthest point
  const dx = farthestPoint.lat - centroid.lat;
  const dy = farthestPoint.lng - centroid.lng;

  // Midpoint between centroid and farthest point
  const midLat = centroid.lat + dx / 2;
  const midLng = centroid.lng + dy / 2;

  // Split points based on which side of the perpendicular bisector they fall
  // We project each point onto the centroid->farthest line and check if it's
  // past the midpoint
  const groupA: Point[] = [];
  const groupB: Point[] = [];

  for (const point of cluster) {
    // Vector from centroid to this point
    const px = point.lat - centroid.lat;
    const py = point.lng - centroid.lng;

    // Dot product with direction vector gives projection along the line
    const projection = px * dx + py * dy;
    const midProjection = (dx * dx + dy * dy) / 2; // midpoint projection

    if (projection < midProjection) {
      groupA.push(point);
    } else {
      groupB.push(point);
    }
  }

  // Handle edge case where all points end up on one side
  if (groupA.length === 0 || groupB.length === 0) {
    // Fall back to splitting by distance from centroid
    const sorted = [...cluster].sort((a, b) => {
      const distA = haversineDistance(centroid.lat, centroid.lng, a.lat, a.lng);
      const distB = haversineDistance(centroid.lat, centroid.lng, b.lat, b.lng);
      return distA - distB;
    });
    const mid = Math.ceil(sorted.length / 2);
    return [sorted.slice(0, mid), sorted.slice(mid)];
  }

  return [groupA, groupB];
}

/**
 * Recursively split a cluster until all resulting clusters have max radius <= maxRadius.
 */
function splitOversizedCluster(cluster: Point[], maxRadius: number): Point[][] {
  // Single point clusters are always valid
  if (cluster.length <= 1) {
    return [cluster];
  }

  const centroid = calculateCentroid(cluster);
  const { point: farthestPoint, distance: maxDistance } = getMaxDistanceFromCentroid(cluster, centroid);

  // Cluster is within radius limit
  if (maxDistance <= maxRadius) {
    return [cluster];
  }

  // Need to split
  const [groupA, groupB] = bisectCluster(cluster, centroid, farthestPoint);

  // Recursively enforce on sub-clusters
  const resultA = splitOversizedCluster(groupA, maxRadius);
  const resultB = splitOversizedCluster(groupB, maxRadius);

  return [...resultA, ...resultB];
}

/**
 * Enforce maximum radius on all clusters by splitting oversized ones.
 */
function enforceClusterMaxRadius(
  clusters: Point[][],
  maxRadius: number
): Point[][] {
  const result: Point[][] = [];

  for (const cluster of clusters) {
    const splitClusters = splitOversizedCluster(cluster, maxRadius);
    result.push(...splitClusters);
  }

  return result;
}

/**
 * DBSCAN clustering algorithm for grouping nearby addresses.
 * Groups houses by proximity so route optimization works on manageable clusters.
 *
 * @param points - Array of geocoded locations
 * @param epsilon - Maximum distance between neighbors (miles)
 * @param minPoints - Minimum points to form a cluster
 * @param maxRadius - Optional max radius from centroid (miles). Clusters exceeding this are split.
 * @returns Array of clusters, each containing point IDs. Noise points get their own single-point clusters.
 */
export function dbscan(
  points: Point[],
  epsilon: number = 1.5,
  minPoints: number = 2,
  maxRadius?: number
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

  // Apply max radius constraint if specified
  if (maxRadius !== undefined) {
    // Convert ID clusters back to Point clusters for radius enforcement
    const pointClusters = result.map((ids) =>
      ids.map((id) => points.find((p) => p.id === id)!).filter(Boolean)
    );

    const enforcedClusters = enforceClusterMaxRadius(pointClusters, maxRadius);

    // Convert back to ID arrays
    return enforcedClusters.map((cluster) => cluster.map((p) => p.id));
  }

  return result;
}
