import type {
  Detection,
  GeoCoordinate,
  ClusterInfo,
  ClusterBounds,
  DensityTier,
  MapFilterState,
  HazardRisk,
  AppState,
} from '../types/sonar';

export type { ClusterInfo, ClusterBounds, DensityTier, MapFilterState };

/**
 * Density color configuration strictly representing spatial concentration.
 * Red = Highest, Orange = Medium/High, Yellow = Moderate, Green = Sparse.
 */
export const DENSITY_CONFIG: Record<
  DensityTier,
  {
    tier: DensityTier;
    label: string;
    color: string;
    bgColor: string;
    pulseColor: string;
    borderColor: string;
  }
> = {
  HIGH: {
    tier: 'HIGH',
    label: 'HIGH CONCENTRATION',
    color: '#ef4444', // Red
    bgColor: 'rgba(239, 68, 68, 0.90)',
    pulseColor: 'rgba(239, 68, 68, 0.40)',
    borderColor: '#b91c1c',
  },
  MEDIUM: {
    tier: 'MEDIUM',
    label: 'MEDIUM CONCENTRATION',
    color: '#f97316', // Orange
    bgColor: 'rgba(249, 115, 22, 0.90)',
    pulseColor: 'rgba(249, 115, 22, 0.40)',
    borderColor: '#c2410c',
  },
  LOW: {
    tier: 'LOW',
    label: 'MODERATE CONCENTRATION',
    color: '#eab308', // Yellow
    bgColor: 'rgba(234, 179, 8, 0.90)',
    pulseColor: 'rgba(234, 179, 8, 0.40)',
    borderColor: '#a16207',
  },
  SPARSE: {
    tier: 'SPARSE',
    label: 'SPARSE CONCENTRATION',
    color: '#22c55e', // Green
    bgColor: 'rgba(34, 197, 94, 0.90)',
    pulseColor: 'rgba(34, 197, 94, 0.40)',
    borderColor: '#15803d',
  },
};

/**
 * Validates that coordinates are valid finite numbers and not [0, 0].
 */
export function isValidCoordinate(geo?: GeoCoordinate | null): geo is GeoCoordinate {
  if (!geo) return false;
  const { lat, lon } = geo;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  // Exclude [0, 0] null-island default
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  return true;
}

/**
 * Projects latitude/longitude to Web Mercator pixel space at current zoom level.
 */
export function projectLatLngToPixel(
  lat: number,
  lon: number,
  zoom: number
): { x: number; y: number } {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const clampedSinY = Math.min(Math.max(sinY, -0.9999), 0.9999);
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + clampedSinY) / (1 - clampedSinY)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/**
 * Determines spatial density tier from count and geographic span.
 */
export function calculateDensityTier(
  count: number,
  bounds: ClusterBounds
): DensityTier {
  const latSpan = bounds.maxLat - bounds.minLat;
  const lonSpan = bounds.maxLon - bounds.minLon;
  const spread = Math.sqrt(latSpan * latSpan + lonSpan * lonSpan);

  // 15+ detections -> HIGH (Red)
  if (count >= 15) return 'HIGH';
  // Exceptionally tight cluster of 8+ in close proximity -> HIGH
  if (count >= 8 && spread <= 0.015) return 'HIGH';

  // 8 to 14 detections -> MEDIUM (Orange)
  if (count >= 8) return 'MEDIUM';

  // 4 to 7 detections -> LOW (Yellow)
  if (count >= 4) return 'LOW';

  // 2 or 3 items -> SPARSE (Green)
  return 'SPARSE';
}

/**
 * Filters active detections based on map filter state and valid coordinates.
 */
export function filterDetections(
  detections: Detection[],
  filters: MapFilterState
): Detection[] {
  return detections.filter((d) => {
    if (!isValidCoordinate(d.geolocation)) return false;

    // Hazard Risk filter
    if (filters.risk === 'HIGH_RISK_ONLY') {
      if (d.hazard_risk !== 'CRITICAL' && d.hazard_risk !== 'HIGH') return false;
    } else if (filters.risk !== 'ALL') {
      if (d.hazard_risk !== filters.risk) return false;
    }

    // Target Class filter
    if (filters.targetClass !== 'ALL') {
      if (d.target_class !== filters.targetClass) return false;
    }

    return true;
  });
}

export type ClusterResultItem =
  | { isCluster: true; cluster: ClusterInfo }
  | { isCluster: false; detection: Detection };

/**
 * Clusters detections dynamically according to map zoom level and cluster pixel radius.
 */
export function clusterDetections(
  detections: Detection[],
  zoom: number,
  clusterRadiusPx: number = 65,
  maxClusterZoom: number = 15
): ClusterResultItem[] {
  const validDets = detections.filter((d) => isValidCoordinate(d.geolocation));
  if (validDets.length === 0) return [];

  // If zoom is very deep, resolve directly into individual markers (unless duplicate coords)
  if (zoom >= maxClusterZoom) {
    return validDets.map((d) => ({ isCluster: false, detection: d }));
  }

  // Project all detections to pixel coordinates at this zoom
  const projected = validDets.map((d) => {
    const geo = d.geolocation!;
    const px = projectLatLngToPixel(geo.lat, geo.lon, zoom);
    return {
      detection: d,
      lat: geo.lat,
      lon: geo.lon,
      px: px.x,
      py: px.y,
      assigned: false,
    };
  });

  const clusters: ClusterResultItem[] = [];

  for (let i = 0; i < projected.length; i++) {
    const p1 = projected[i];
    if (p1.assigned) continue;

    const group = [p1];
    p1.assigned = true;

    for (let j = i + 1; j < projected.length; j++) {
      const p2 = projected[j];
      if (p2.assigned) continue;

      const dist = Math.hypot(p1.px - p2.px, p1.py - p2.py);
      if (dist <= clusterRadiusPx) {
        p2.assigned = true;
        group.push(p2);
      }
    }

    if (group.length === 1) {
      clusters.push({ isCluster: false, detection: group[0].detection });
    } else {
      // Calculate cluster metrics
      let sumLat = 0;
      let sumLon = 0;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLon = Infinity;
      let maxLon = -Infinity;

      const clusterDets: Detection[] = [];
      const riskCounts: Record<HazardRisk, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      };
      const classCounts: Record<string, number> = {};
      let expertVerifiedCount = 0;

      for (const item of group) {
        const d = item.detection;
        clusterDets.push(d);
        sumLat += item.lat;
        sumLon += item.lon;
        if (item.lat < minLat) minLat = item.lat;
        if (item.lat > maxLat) maxLat = item.lat;
        if (item.lon < minLon) minLon = item.lon;
        if (item.lon > maxLon) maxLon = item.lon;

        riskCounts[d.hazard_risk] = (riskCounts[d.hazard_risk] || 0) + 1;
        classCounts[d.target_class] = (classCounts[d.target_class] || 0) + 1;
        if (d.expert_verified) expertVerifiedCount++;
      }

      const meanLat = sumLat / group.length;
      const meanLon = sumLon / group.length;

      // Determine highest danger level present in the cluster
      let highestRisk: HazardRisk = 'LOW';
      if (riskCounts.CRITICAL > 0) highestRisk = 'CRITICAL';
      else if (riskCounts.HIGH > 0) highestRisk = 'HIGH';
      else if (riskCounts.MEDIUM > 0) highestRisk = 'MEDIUM';

      const bounds: ClusterBounds = { minLat, maxLat, minLon, maxLon };
      const densityTier = calculateDensityTier(group.length, bounds);

      const clusterInfo: ClusterInfo = {
        id: `cluster-${zoom}-${Math.round(meanLat * 1000)}-${Math.round(meanLon * 1000)}-${group.length}`,
        center: { lat: meanLat, lon: meanLon },
        bounds,
        count: group.length,
        frameCount: group.length,
        totalAnomalyCount: clusterDets.length,
        densityTier,
        frames: [],
        detections: clusterDets,
        highestRisk,
        riskCounts,
        classCounts,
        expertVerifiedCount,
      };

      clusters.push({ isCluster: true, cluster: clusterInfo });
    }
  }

  return clusters;
}

/**
 * Returns all active detections across single survey and batch survey records.
 */
export function getAllActiveDetections(state: AppState): Detection[] {
  const all: Detection[] = [];
  const seenKeys = new Set<string>();

  // 1. In folder / simulation mode: gather all detections across batch frames
  if (state.uploadMode === 'folder' && state.batchResults && state.batchResults.length > 0) {
    for (let rIdx = 0; rIdx < state.batchResults.length; rIdx++) {
      const rec = state.batchResults[rIdx];
      if (rec.detections && rec.detections.length > 0) {
        for (let dIdx = 0; dIdx < rec.detections.length; dIdx++) {
          const d = rec.detections[dIdx];
          const fname = rec.filename || (rec as any).fileName || `frame_${rIdx}`;
          const uniqueKey = `${fname}_${d.id || dIdx}`;
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            all.push(d);
          }
        }
      }
    }
  }

  // 2. Single analysis result (or currently focused live result during single upload / batch run)
  if (state.result?.detections && state.result.detections.length > 0) {
    for (let dIdx = 0; dIdx < state.result.detections.length; dIdx++) {
      const d = state.result.detections[dIdx];
      const key = `result_${d.id || dIdx}`;
      if (state.uploadMode === 'single') {
        all.push(d);
      } else if (all.length === 0 && !seenKeys.has(key)) {
        seenKeys.add(key);
        all.push(d);
      }
    }
  }

  return all;
}
