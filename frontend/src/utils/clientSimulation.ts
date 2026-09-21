// src/utils/clientSimulation.ts
// Autonomous Client-Side Sonar Simulation Engine
// Provides high-fidelity demonstration data when running in offline/air-gapped or Vercel static environments.

import type { Detection, AnalysisResult, BatchImageRecord, GeoCoordinate, TargetClass, HazardRisk, ShadowEvidence } from '../types/sonar';
import { DEFAULT_MUMBAI_KOCHI_WAYPOINTS } from '../store/appReducer';

const CLASS_SPECS: Record<TargetClass, { risk: HazardRisk; dims: { l: number; w: number; h: number }; shadow: ShadowEvidence }> = {
  mine_cylinder: { risk: 'CRITICAL', dims: { l: 1.8, w: 0.6, h: 0.6 }, shadow: 'SUPPORTING' },
  submarine_pipeline: { risk: 'HIGH', dims: { l: 15.0, w: 0.8, h: 0.8 }, shadow: 'SUPPORTING' },
  shipwreck: { risk: 'HIGH', dims: { l: 12.0, w: 4.5, h: 2.5 }, shadow: 'SUPPORTING' },
  ghost_net: { risk: 'MEDIUM', dims: { l: 3.0, w: 2.0, h: 0.5 }, shadow: 'NEUTRAL' },
  crab_pot: { risk: 'LOW', dims: { l: 0.8, w: 0.8, h: 0.6 }, shadow: 'SUPPORTING' },
};

function createSampleSvgThumbnail(targetClass: TargetClass, risk: HazardRisk): string {
  const colors: Record<HazardRisk, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#22c55e',
  };
  const c = colors[risk];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#080f1a"/>
    <circle cx="64" cy="64" r="50" fill="none" stroke="#1e293b" stroke-width="2"/>
    <circle cx="64" cy="64" r="30" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="4 4"/>
    <rect x="42" y="46" width="44" height="36" rx="4" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="2"/>
    <text x="64" y="98" font-family="monospace" font-size="10" font-weight="bold" fill="${c}" text-anchor="middle">${risk}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export function interpolateWaypoint(waypoints: GeoCoordinate[], fraction: number): GeoCoordinate {
  if (!waypoints || waypoints.length === 0) {
    return { lat: 15.2993, lon: 73.7240 };
  }
  if (fraction <= 0) return waypoints[0];
  if (fraction >= 1) return waypoints[waypoints.length - 1];

  const totalSegments = waypoints.length - 1;
  const rawIdx = fraction * totalSegments;
  const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1);
  const segFrac = rawIdx - segIdx;

  const p1 = waypoints[segIdx];
  const p2 = waypoints[segIdx + 1];

  const lat = p1.lat + (p2.lat - p1.lat) * segFrac;
  const lon = p1.lon + (p2.lon - p1.lon) * segFrac;

  // Approximate heading in degrees
  const dLat = p2.lat - p1.lat;
  const dLon = p2.lon - p1.lon;
  const heading = (Math.atan2(dLon, dLat) * 180) / Math.PI;

  return {
    lat: Math.round(lat * 1000000) / 1000000,
    lon: Math.round(lon * 1000000) / 1000000,
    heading: Math.round(((heading + 360) % 360) * 10) / 10,
  };
}

export function generateSimulatedFrameDetections(
  sequence: number,
  total: number,
  gps: GeoCoordinate,
  filename?: string
): Detection[] {
  // Hotspot clustering pattern: dense contacts around 2-3 hotspots along route
  const normalizedPos = sequence / Math.max(1, total);
  const isHotspot =
    (normalizedPos >= 0.20 && normalizedPos <= 0.35) ||
    (normalizedPos >= 0.55 && normalizedPos <= 0.70) ||
    (normalizedPos >= 0.85 && normalizedPos <= 0.95);

  const fname = (filename || '').toLowerCase();
  const detections: Detection[] = [];

  // If specific filename indicates a class
  if (fname.includes('mine') || fname.includes('cylinder')) {
    detections.push(buildDetection(sequence, 1, 'mine_cylinder', gps));
  } else if (fname.includes('pipe') || fname.includes('pipeline')) {
    detections.push(buildDetection(sequence, 1, 'submarine_pipeline', gps));
  } else if (fname.includes('wreck') || fname.includes('shipwreck')) {
    detections.push(buildDetection(sequence, 1, 'shipwreck', gps));
  } else if (fname.includes('net') || fname.includes('ghost')) {
    detections.push(buildDetection(sequence, 1, 'ghost_net', gps));
  } else if (isHotspot) {
    // Generate 1-2 realistic detections in hotspot zones
    const count = (sequence % 2) + 1;
    const pool: TargetClass[] = ['mine_cylinder', 'submarine_pipeline', 'shipwreck', 'ghost_net', 'crab_pot'];
    for (let i = 0; i < count; i++) {
      const cls = pool[(sequence + i) % pool.length];
      detections.push(buildDetection(sequence, i + 1, cls, gps));
    }
  } else if (sequence % 4 === 0) {
    // Occasional seafloor crab pot or minor contact
    detections.push(buildDetection(sequence, 1, 'crab_pot', gps));
  }

  return detections;
}

function buildDetection(
  seq: number,
  targetIdx: number,
  targetClass: TargetClass,
  vesselGps: GeoCoordinate
): Detection {
  const spec = CLASS_SPECS[targetClass];
  const conf = Math.round((0.84 + Math.random() * 0.14) * 100) / 100;
  const id = `tgt-sim-${String(seq).padStart(2, '0')}-${String(targetIdx).padStart(2, '0')}`;

  // Small geographic offset from vessel track
  const latOffset = ((Math.random() - 0.5) * 0.008);
  const lonOffset = ((Math.random() - 0.5) * 0.008);

  const tgtLat = Math.round((vesselGps.lat + latOffset) * 10000000) / 10000000;
  const tgtLon = Math.round((vesselGps.lon + lonOffset) * 10000000) / 10000000;

  const w_m = spec.dims.w;
  const l_m = spec.dims.l;
  const h_m = spec.dims.h;
  const area_m2 = Math.round(w_m * l_m * 100) / 100;

  const x1 = Math.floor(100 + Math.random() * 300);
  const y1 = Math.floor(100 + Math.random() * 300);
  const bw = Math.floor(40 + w_m * 25);
  const bh = Math.floor(40 + l_m * 25);

  return {
    id,
    target_class: targetClass,
    confidence: conf,
    confidence_ai: conf,
    shadow_evidence: spec.shadow,
    hazard_risk: spec.risk,
    review_status: spec.shadow === 'SUPPORTING' ? 'VERIFIED_3D' : 'UNVERIFIED',
    expert_status: 'UNVERIFIED',
    expert_verified: false,
    dimensions: {
      length_m: l_m,
      width_m: w_m,
      area_m2,
      relief_height_m: h_m,
    },
    geolocation: {
      lat: tgtLat,
      lon: tgtLon,
      heading: vesselGps.heading ?? 180,
    },
    local_offset: {
      x_m: Math.round(lonOffset * 111000 * 10) / 10,
      y_m: Math.round(latOffset * 111000 * 10) / 10,
    },
    bounding_box: [x1, y1, x1 + bw, y1 + bh],
    mask_contour: [
      [x1, y1],
      [x1 + bw, y1],
      [x1 + bw, y1 + bh],
      [x1, y1 + bh],
    ],
    thumbnail_base64: createSampleSvgThumbnail(targetClass, spec.risk),
  };
}

export function synthesizeSingleAnalysisResult(
  file: File,
  vesselGps: GeoCoordinate,
  previewUrl?: string | null
): AnalysisResult {
  const fname = file.name.toLowerCase();
  const detections: Detection[] = [];

  let primaryClass: TargetClass = 'mine_cylinder';
  if (fname.includes('pipe')) primaryClass = 'submarine_pipeline';
  else if (fname.includes('wreck')) primaryClass = 'shipwreck';
  else if (fname.includes('net') || fname.includes('07600')) primaryClass = 'ghost_net';
  else if (fname.includes('pot') || fname.includes('crab')) primaryClass = 'crab_pot';

  detections.push(buildDetection(1, 1, primaryClass, vesselGps));

  // If pipeline or shipwreck, sometimes add adjacent contact
  if (primaryClass === 'submarine_pipeline' || primaryClass === 'shipwreck') {
    detections.push(buildDetection(1, 2, 'crab_pot', vesselGps));
  }

  const rawUrl = previewUrl || URL.createObjectURL(file);

  return {
    raw_image_url: rawUrl,
    enhanced_image_url: rawUrl,
    detections,
    kpis: {
      total_surveys: 1,
      total_detections: detections.length,
      verified_3d_objects: detections.filter((d) => d.shadow_evidence === 'SUPPORTING').length,
      critical_hazards: detections.filter((d) => d.hazard_risk === 'CRITICAL').length,
    },
    processing_meta: {
      slant_range_corrected: true,
      clahe_applied: true,
      nadir_excised: false,
      confidence_threshold: 0.25,
      processing_time_ms: 54.2,
    },
  };
}
