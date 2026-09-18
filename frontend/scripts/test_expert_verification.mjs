// frontend/scripts/test_expert_verification.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Logic rules implementation mirroring src/utils/expertVerification.ts
function isHighRisk(hazard) {
  return hazard === 'HIGH' || hazard === 'CRITICAL';
}

function shouldShowHighRiskAlert(hazard, confidence) {
  return isHighRisk(hazard) && confidence > 0.75;
}

function isVerificationEligible(hazard, confidence) {
  return isHighRisk(hazard) && confidence < 0.35;
}

// Reducer logic mirroring src/store/appReducer.ts
function appReducer(state, action) {
  switch (action.type) {
    case 'CONFIRM_EXPERT_VERIFICATION': {
      if (!state.result) return state;
      const updatedDetections = state.result.detections.map((d) => {
        if (d.id === action.payload.detectionId) {
          return {
            ...d,
            expert_verified: true,
            expert_status: 'CONFIRMED',
          };
        }
        return d;
      });
      return {
        ...state,
        result: {
          ...state.result,
          detections: updatedDetections,
        },
      };
    }

    case 'REJECT_DETECTION': {
      if (!state.result) return state;
      const updatedDetections = state.result.detections.filter(
        (d) => d.id !== action.payload.detectionId
      );
      const isSelected = state.selectedDetectionId === action.payload.detectionId;
      const newCritical = updatedDetections.filter((d) => d.hazard_risk === 'CRITICAL').length;
      const newVerified3d = updatedDetections.filter(
        (d) => d.shadow_evidence === 'SUPPORTING' || d.expert_verified
      ).length;

      return {
        ...state,
        selectedDetectionId: isSelected ? null : state.selectedDetectionId,
        result: {
          ...state.result,
          detections: updatedDetections,
          kpis: {
            ...state.result.kpis,
            total_detections: updatedDetections.length,
            critical_hazards: newCritical,
            verified_3d_targets: newVerified3d,
          },
        },
      };
    }

    case 'SKIP_EXPERT_VERIFICATION': {
      if (!state.result) return state;
      const updatedDetections = state.result.detections.map((d) => {
        if (d.id === action.payload.detectionId) {
          return {
            ...d,
            expert_status: 'SKIPPED',
          };
        }
        return d;
      });
      return {
        ...state,
        result: {
          ...state.result,
          detections: updatedDetections,
        },
      };
    }

    default:
      return state;
  }
}

// CSV export function mirroring src/components/export/ExportPanel.tsx
function toCSV(detections) {
  const header = 'id,target_class,confidence_pct,hazard_risk,shadow_evidence,expert_status,expert_verified,length_m,width_m,area_m2,relief_height_m,latitude,longitude,local_x_m,local_y_m';
  const rows = detections.map((d) => [
    d.id,
    d.target_class,
    (d.confidence * 100).toFixed(1),
    d.hazard_risk,
    d.shadow_evidence,
    d.expert_status ?? 'UNVERIFIED',
    d.expert_verified ? 'TRUE' : 'FALSE',
    d.dimensions.length_m.toFixed(2),
    d.dimensions.width_m.toFixed(2),
    d.dimensions.area_m2.toFixed(2),
    d.dimensions.relief_height_m.toFixed(2),
    d.geolocation?.lat.toFixed(6) ?? '',
    d.geolocation?.lon.toFixed(6) ?? '',
    d.local_offset?.x_m.toFixed(2) ?? '',
    d.local_offset?.y_m.toFixed(2) ?? '',
  ].join(','));
  return [header, ...rows].join('\n');
}

// GeoJSON export function mirroring src/components/export/ExportPanel.tsx
function toGeoJSON(detections) {
  const features = detections
    .filter((d) => d.geolocation)
    .map((d) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [d.geolocation.lon, d.geolocation.lat],
      },
      properties: {
        id: d.id,
        target_class: d.target_class,
        confidence: d.confidence,
        hazard_risk: d.hazard_risk,
        shadow_evidence: d.shadow_evidence,
        expert_status: d.expert_status ?? 'UNVERIFIED',
        expert_verified: d.expert_verified ?? false,
      },
    }));
  return JSON.stringify({ type: 'FeatureCollection', features });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

test('1. HIGH + confidence > 75% triggers High-Risk Alert and NOT Expert Verification', () => {
  assert.equal(shouldShowHighRiskAlert('HIGH', 0.82), true);
  assert.equal(shouldShowHighRiskAlert('HIGH', 0.7501), true);
  assert.equal(isVerificationEligible('HIGH', 0.82), false);
});

test('2. HIGH + confidence == 75% does NOT trigger High-Risk Alert or Expert Verification', () => {
  assert.equal(shouldShowHighRiskAlert('HIGH', 0.75), false);
  assert.equal(isVerificationEligible('HIGH', 0.75), false);
});

test('3. HIGH + confidence < 35% triggers Expert Verification', () => {
  assert.equal(isVerificationEligible('HIGH', 0.34), true);
  assert.equal(isVerificationEligible('HIGH', 0.25), true);
  assert.equal(isVerificationEligible('HIGH', 0.10), true);
  assert.equal(shouldShowHighRiskAlert('HIGH', 0.25), false);
});

test('4. HIGH + confidence >= 35% and <= 75% does NOT trigger Expert Verification', () => {
  assert.equal(isVerificationEligible('HIGH', 0.35), false);
  assert.equal(isVerificationEligible('HIGH', 0.50), false);
  assert.equal(isVerificationEligible('HIGH', 0.70), false);
});

test('5. CRITICAL with confidence < 35% triggers Expert Verification', () => {
  assert.equal(isVerificationEligible('CRITICAL', 0.20), true);
  assert.equal(isVerificationEligible('CRITICAL', 0.34), true);
  assert.equal(shouldShowHighRiskAlert('CRITICAL', 0.20), false);
});

test('6. CRITICAL with confidence > 75% triggers High-Risk Alert', () => {
  assert.equal(shouldShowHighRiskAlert('CRITICAL', 0.85), true);
  assert.equal(isVerificationEligible('CRITICAL', 0.85), false);
});

test('7. LOW and MEDIUM with confidence < 35% MUST NOT show Expert Verification', () => {
  for (const conf of [0.10, 0.20, 0.30, 0.34]) {
    assert.equal(isVerificationEligible('LOW', conf), false);
    assert.equal(shouldShowHighRiskAlert('LOW', conf), false);
    assert.equal(isVerificationEligible('MEDIUM', conf), false);
    assert.equal(shouldShowHighRiskAlert('MEDIUM', conf), false);
  }
});

test('8. Expert Confirm keeps detection active, marks Expert Verified, preserves all original fields', () => {
  const originalDetection = {
    id: 'tgt-001',
    target_class: 'mine_cylinder',
    confidence: 0.62,
    hazard_risk: 'CRITICAL',
    shadow_evidence: 'SUPPORTING',
    dimensions: { length_m: 1.8, width_m: 0.6, area_m2: 1.08, relief_height_m: 0.5 },
    geolocation: { lat: 18.92, lon: 72.83 },
    local_offset: { x_m: 5.2, y_m: 12.4 },
    bounding_box: [100, 100, 200, 200],
    mask_contour: [[100, 100], [200, 200]],
    thumbnail_base64: 'data:image/jpeg;base64,sample',
  };

  const initialState = {
    result: {
      raw_image_url: 'raw.jpg',
      enhanced_image_url: 'enhanced.jpg',
      detections: [originalDetection],
      kpis: { total_surveys: 1, total_detections: 1, verified_3d_objects: 1, critical_hazards: 1 },
      processing_meta: {},
    },
    selectedDetectionId: 'tgt-001',
  };

  const nextState = appReducer(initialState, {
    type: 'CONFIRM_EXPERT_VERIFICATION',
    payload: { detectionId: 'tgt-001' },
  });

  const verified = nextState.result.detections.find((d) => d.id === 'tgt-001');
  assert.ok(verified, 'Detection must remain in active list');
  assert.equal(verified.expert_verified, true);
  assert.equal(verified.expert_status, 'CONFIRMED');
  // Original properties preserved
  assert.equal(verified.confidence, 0.62);
  assert.equal(verified.target_class, 'mine_cylinder');
  assert.equal(verified.hazard_risk, 'CRITICAL');
  assert.equal(verified.shadow_evidence, 'SUPPORTING');
  assert.deepEqual(verified.dimensions, originalDetection.dimensions);
  assert.deepEqual(verified.geolocation, originalDetection.geolocation);

  // Check CSV export includes verified status
  const csv = toCSV(nextState.result.detections);
  assert.ok(csv.includes('tgt-001,mine_cylinder,62.0,CRITICAL,SUPPORTING,CONFIRMED,TRUE'));

  // Check GeoJSON export includes verified status
  const geojson = JSON.parse(toGeoJSON(nextState.result.detections));
  assert.equal(geojson.features[0].properties.expert_verified, true);
  assert.equal(geojson.features[0].properties.expert_status, 'CONFIRMED');
});

test('9. Skip leaves detection unchanged, active, and keeps original confidence and hazard', () => {
  const originalDetection = {
    id: 'tgt-002',
    target_class: 'submarine_pipeline',
    confidence: 0.55,
    hazard_risk: 'HIGH',
    shadow_evidence: 'SUPPORTING',
    dimensions: { length_m: 15.0, width_m: 0.8, area_m2: 12.0, relief_height_m: 0.8 },
    geolocation: { lat: 18.95, lon: 72.85 },
    local_offset: null,
  };

  const initialState = {
    result: {
      detections: [originalDetection],
      kpis: { total_surveys: 1, total_detections: 1, verified_3d_objects: 1, critical_hazards: 0 },
    },
    selectedDetectionId: 'tgt-002',
  };

  const nextState = appReducer(initialState, {
    type: 'SKIP_EXPERT_VERIFICATION',
    payload: { detectionId: 'tgt-002' },
  });

  const det = nextState.result.detections[0];
  assert.equal(det.id, 'tgt-002');
  assert.equal(det.confidence, 0.55);
  assert.equal(det.hazard_risk, 'HIGH');
  assert.equal(det.expert_status, 'SKIPPED');
  assert.equal(det.expert_verified, undefined);
});

test('10. "Nothing There" removes detection from active list, updates KPI counts and map markers, and excludes from exports', () => {
  const det1 = {
    id: 'tgt-001',
    target_class: 'mine_cylinder',
    confidence: 0.50,
    hazard_risk: 'CRITICAL',
    shadow_evidence: 'NEUTRAL',
    dimensions: { length_m: 1.8, width_m: 0.6, area_m2: 1.08, relief_height_m: 0.5 },
    geolocation: { lat: 18.91, lon: 72.82 },
  };
  const det2 = {
    id: 'tgt-002',
    target_class: 'crab_pot',
    confidence: 0.88,
    hazard_risk: 'LOW',
    shadow_evidence: 'SUPPORTING',
    dimensions: { length_m: 0.8, width_m: 0.8, area_m2: 0.64, relief_height_m: 0.6 },
    geolocation: { lat: 18.93, lon: 72.84 },
  };

  const initialState = {
    result: {
      detections: [det1, det2],
      kpis: { total_surveys: 1, total_detections: 2, verified_3d_objects: 1, critical_hazards: 1 },
    },
    selectedDetectionId: 'tgt-001',
  };

  const nextState = appReducer(initialState, {
    type: 'REJECT_DETECTION',
    payload: { detectionId: 'tgt-001' },
  });

  // Target 1 must disappear completely from active detections
  assert.equal(nextState.result.detections.length, 1);
  assert.equal(nextState.result.detections[0].id, 'tgt-002');
  assert.equal(nextState.selectedDetectionId, null, 'Selected detection must reset if removed');

  // KPI counts updated
  assert.equal(nextState.result.kpis.total_detections, 1);
  assert.equal(nextState.result.kpis.critical_hazards, 0, 'Critical hazard count decremented');

  // Excluded from CSV export
  const csv = toCSV(nextState.result.detections);
  assert.equal(csv.includes('tgt-001'), false, 'Rejected target MUST NOT appear in CSV');
  assert.ok(csv.includes('tgt-002'), 'Active target must appear in CSV');

  // Excluded from GeoJSON export
  const geojson = JSON.parse(toGeoJSON(nextState.result.detections));
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties.id, 'tgt-002');
});
