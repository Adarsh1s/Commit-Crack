// src/utils/spatialObservations.ts
import type {
  AppState,
  Detection,
  GeoCoordinate,
  HazardRisk,
  MapFilterState,
  SurveyFrame,
  TargetClass,
} from '../types/sonar';

/**
 * Validates that coordinates are valid finite numbers, within boundaries, and not [0, 0].
 */
export function isValidCoordinate(geo?: GeoCoordinate | null): geo is GeoCoordinate {
  if (!geo) return false;
  const { lat, lon } = geo;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  return true;
}

export function isHighRisk(hazard: HazardRisk): boolean {
  return hazard === 'HIGH' || hazard === 'CRITICAL';
}

const RISK_SEVERITY_ORDER: Record<HazardRisk, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const RISK_BASE_WEIGHT: Record<HazardRisk, number> = {
  CRITICAL: 0.7,
  HIGH: 0.5,
  MEDIUM: 0.3,
  LOW: 0.15,
};

/**
 * Calculates a bounded, normalized heat weight (0.0 to 1.0) for a SurveyFrame.
 * Combines highest risk severity, log-scaled anomaly count (diminishing returns),
 * maximum detection confidence, and expert review confirmation.
 */
export function calculateFrameHeatWeight(params: {
  highestRisk: HazardRisk;
  anomalyCount: number;
  highestConfidence: number;
  expertVerified: boolean;
}): number {
  if (params.anomalyCount === 0) {
    return 0.05; // Low baseline for surveyed frame with 0 anomalies
  }

  const base = RISK_BASE_WEIGHT[params.highestRisk] ?? 0.2;
  // Diminishing returns for high count (log10 scale)
  const countBonus = 0.2 * Math.log10(1 + params.anomalyCount);
  const confBonus = 0.15 * Math.min(1.0, Math.max(0.0, params.highestConfidence));
  const verifiedBonus = params.expertVerified ? 0.05 : 0.0;

  const rawWeight = base + countBonus + confBonus + verifiedBonus;
  // Clamp strictly between 0.0 and 1.0
  return Math.min(1.0, Math.max(0.0, Number(rawWeight.toFixed(4))));
}

/**
 * Aggregates detections within a frame into summary statistics.
 */
function aggregateFrameDetections(
  detections: Detection[],
  frameGps: GeoCoordinate | null
): {
  activeDetections: Detection[];
  highestRisk: HazardRisk;
  highestConfidence: number;
  riskSummary: Record<HazardRisk, number>;
  classSummary: Record<string, number>;
  expertVerified: boolean;
  expertVerifiedCount: number;
} {
  const riskSummary: Record<HazardRisk, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const classSummary: Record<string, number> = {};
  let maxRiskSeverity = 0;
  let highestRisk: HazardRisk = 'LOW';
  let highestConfidence = 0;
  let expertVerifiedCount = 0;

  const activeDetections: Detection[] = [];

  for (let i = 0; i < detections.length; i++) {
    const rawDet = detections[i];
    // Coordinate inheritance: if detection lacks geolocation, fallback to parent frame GPS
    const d: Detection = {
      ...rawDet,
      geolocation: rawDet.geolocation && isValidCoordinate(rawDet.geolocation)
        ? rawDet.geolocation
        : frameGps,
    };

    activeDetections.push(d);
    riskSummary[d.hazard_risk] = (riskSummary[d.hazard_risk] || 0) + 1;
    classSummary[d.target_class] = (classSummary[d.target_class] || 0) + 1;

    const sev = RISK_SEVERITY_ORDER[d.hazard_risk] ?? 1;
    if (sev > maxRiskSeverity) {
      maxRiskSeverity = sev;
      highestRisk = d.hazard_risk;
    }

    if (d.confidence > highestConfidence) {
      highestConfidence = d.confidence;
    }

    if (d.expert_verified) {
      expertVerifiedCount++;
    }
  }

  return {
    activeDetections,
    highestRisk,
    highestConfidence,
    riskSummary,
    classSummary,
    expertVerified: expertVerifiedCount > 0,
    expertVerifiedCount,
  };
}

/**
 * Derives map-level SurveyFrame observations from the application state.
 *
 * Guarantees:
 * 1. Exactly 1 SurveyFrame per analyzed source image / batch record.
 * 2. 10 detections at the same coordinate produce 1 SurveyFrame with anomalyCount=10.
 * 3. Frames sharing identical GPS coordinates remain distinct SurveyFrame instances.
 */
export function buildSurveyFrames(state: AppState): SurveyFrame[] {
  const frames: SurveyFrame[] = [];

  // 1. Folder / Batch Survey Mode (active whenever batch records exist)
  if (state.batchResults && state.batchResults.length > 0) {
    for (let idx = 0; idx < state.batchResults.length; idx++) {
      const rec = state.batchResults[idx];
      const filename = rec.filename || `survey_frame_${idx + 1}.jpg`;
      const frameId = `frame_${filename}_${rec.sequence ?? idx}`;

      let frameGps: GeoCoordinate | null = null;
      if (rec.gps && typeof rec.gps.latitude === 'number' && typeof rec.gps.longitude === 'number') {
        const candidate = {
          lat: rec.gps.latitude,
          lon: rec.gps.longitude,
          heading: rec.gps.heading ?? undefined,
        };
        if (isValidCoordinate(candidate)) {
          frameGps = candidate;
        }
      }

      // Fallback GPS from first detection if record GPS was empty
      const rawDetections = rec.detections ?? [];
      if (!frameGps && rawDetections.length > 0) {
        const firstValid = rawDetections.find((d) => isValidCoordinate(d.geolocation));
        if (firstValid?.geolocation) {
          frameGps = firstValid.geolocation;
        }
      }

      const {
        activeDetections,
        highestRisk,
        highestConfidence,
        riskSummary,
        classSummary,
        expertVerified,
        expertVerifiedCount,
      } = aggregateFrameDetections(rawDetections, frameGps);

      const anomalyCount = activeDetections.length;
      const heatWeight = calculateFrameHeatWeight({
        highestRisk,
        anomalyCount,
        highestConfidence,
        expertVerified,
      });

      // Thumbnail resolution from detections or sample
      const thumb =
        activeDetections[0]?.thumbnail_base64 ||
        (rec as any).thumbnail_base64 ||
        (rec as any).enhanced_image_url ||
        undefined;

      frames.push({
        id: frameId,
        filename,
        sequence: rec.sequence ?? idx + 1,
        timestamp: rec.timestamp,
        geolocation: frameGps,
        thumbnail_url: thumb,
        status: rec.status,
        anomalyCount,
        detections: activeDetections,
        highestRisk,
        highestConfidence,
        riskSummary,
        classSummary,
        expertVerified,
        expertVerifiedCount,
        heatWeight,
      });
    }
    return frames;
  }

  // 2. Single Image Survey Mode
  if (state.result) {
    const filename = state.sonarFile?.name || 'single_sonar_scan.jpg';
    const rawDetections = state.result.detections ?? [];

    let frameGps: GeoCoordinate | null = null;
    const firstValid = rawDetections.find((d) => isValidCoordinate(d.geolocation));
    if (firstValid?.geolocation) {
      frameGps = firstValid.geolocation;
    } else if (state.userLocation && isValidCoordinate(state.userLocation)) {
      frameGps = state.userLocation;
    }

    const {
      activeDetections,
      highestRisk,
      highestConfidence,
      riskSummary,
      classSummary,
      expertVerified,
      expertVerifiedCount,
    } = aggregateFrameDetections(rawDetections, frameGps);

    const anomalyCount = activeDetections.length;
    const heatWeight = calculateFrameHeatWeight({
      highestRisk,
      anomalyCount,
      highestConfidence,
      expertVerified,
    });

    frames.push({
      id: `frame_single_${filename}`,
      filename,
      sequence: 1,
      geolocation: frameGps,
      thumbnail_url: activeDetections[0]?.thumbnail_base64 || state.result.enhanced_image_url || undefined,
      raw_image_url: state.result.raw_image_url,
      enhanced_image_url: state.result.enhanced_image_url,
      status: state.status === 'complete' ? 'processed' : 'idle',
      anomalyCount,
      detections: activeDetections,
      highestRisk,
      highestConfidence,
      riskSummary,
      classSummary,
      expertVerified,
      expertVerifiedCount,
      heatWeight,
    });
  }

  return frames;
}

/**
 * Filters SurveyFrames based on map filter state.
 *
 * Filter rules:
 * - A frame matches a risk filter if it contains at least one active detection matching that risk.
 * - A frame matches a class filter if it contains at least one active detection matching that target class.
 * - Only frames with valid coordinates are returned for map display.
 */
export function filterSurveyFrames(
  frames: SurveyFrame[],
  filters: MapFilterState
): SurveyFrame[] {
  return frames.filter((frame) => {
    if (!isValidCoordinate(frame.geolocation)) return false;

    // If frame has no active anomalies, exclude from active anomaly map by default
    if (frame.anomalyCount === 0) return false;

    // Risk Filter
    if (filters.risk === 'HIGH_RISK_ONLY') {
      const hasHighRisk = frame.detections.some(
        (d) => d.hazard_risk === 'CRITICAL' || d.hazard_risk === 'HIGH'
      );
      if (!hasHighRisk) return false;
    } else if (filters.risk !== 'ALL') {
      const hasMatchingRisk = frame.detections.some((d) => d.hazard_risk === filters.risk);
      if (!hasMatchingRisk) return false;
    }

    // Target Class Filter
    if (filters.targetClass !== 'ALL') {
      const hasMatchingClass = frame.detections.some(
        (d) => d.target_class === filters.targetClass
      );
      if (!hasMatchingClass) return false;
    }

    return true;
  });
}

/**
 * Computes high-level observational statistics across survey frames.
 */
export function getObservationStats(frames: SurveyFrame[]) {
  let totalAnomalies = 0;
  let criticalFrames = 0;
  let highRiskFrames = 0;
  let verifiedFrames = 0;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    totalAnomalies += f.anomalyCount;
    if (f.highestRisk === 'CRITICAL') criticalFrames++;
    if (f.highestRisk === 'HIGH' || f.highestRisk === 'CRITICAL') highRiskFrames++;
    if (f.expertVerified) verifiedFrames++;
  }

  return {
    totalFrames: frames.length,
    totalAnomalies,
    criticalFrames,
    highRiskFrames,
    verifiedFrames,
  };
}
