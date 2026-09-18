// frontend/scripts/test_verify_feature_comprehensive.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

function isHighRisk(hazard) {
  return hazard === 'HIGH' || hazard === 'CRITICAL';
}

function shouldShowHighRiskAlert(hazard, confidence) {
  return isHighRisk(hazard) && confidence > 0.75;
}

function isVerificationEligible(hazard, confidence) {
  return isHighRisk(hazard) && confidence < 0.35;
}

// Replicate reducer dispatch logic for Expert Verification workflows
function createMockState(detections) {
  return {
    selectedDetectionId: null,
    selectedCluster: null,
    result: {
      image_id: 'test_sonar_img_001',
      raw_image_url: '/samples/mine_cylinder_tile.png',
      enhanced_image_url: '/samples/mine_cylinder_tile.png',
      detections,
      kpis: {
        total_detections: detections.length,
        critical_hazards: detections.filter((d) => d.hazard_risk === 'CRITICAL').length,
        high_risk_targets: detections.filter((d) => isHighRisk(d.hazard_risk)).length,
        verified_3d_targets: detections.filter((d) => d.expert_verified).length,
      },
    },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'CONFIRM_EXPERT_VERIFICATION': {
      if (!state.result) return state;
      const updatedDetections = state.result.detections.map((d) =>
        d.id === action.payload.detectionId
          ? { ...d, expert_verified: true, expert_status: 'CONFIRMED' }
          : d
      );
      return {
        ...state,
        result: {
          ...state.result,
          detections: updatedDetections,
          kpis: {
            ...state.result.kpis,
            verified_3d_targets: updatedDetections.filter((d) => d.expert_verified).length,
          },
        },
      };
    }

    case 'REJECT_DETECTION': {
      if (!state.result) return state;
      const updatedDetections = state.result.detections.filter(
        (d) => d.id !== action.payload.detectionId
      );
      return {
        ...state,
        selectedDetectionId: state.selectedDetectionId === action.payload.detectionId ? null : state.selectedDetectionId,
        result: {
          ...state.result,
          detections: updatedDetections,
          kpis: {
            ...state.result.kpis,
            total_detections: updatedDetections.length,
            critical_hazards: updatedDetections.filter((d) => d.hazard_risk === 'CRITICAL').length,
            high_risk_targets: updatedDetections.filter((d) => isHighRisk(d.hazard_risk)).length,
            verified_3d_targets: updatedDetections.filter((d) => d.expert_verified).length,
          },
        },
      };
    }

    case 'SKIP_EXPERT_VERIFICATION': {
      if (!state.result) return state;
      const updatedDetections = state.result.detections.map((d) =>
        d.id === action.payload.detectionId ? { ...d, expert_status: 'SKIPPED' } : d
      );
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

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Expert Verify Feature Under New Condition (< 35% Confidence & High/Critical)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 1: Anomaly with High Risk (CRITICAL) and Confidence < 35% triggers Expert Verification', () => {
  const confidences = [0.10, 0.18, 0.25, 0.30, 0.34, 0.349];
  for (const conf of confidences) {
    assert.equal(
      isVerificationEligible('CRITICAL', conf),
      true,
      `CRITICAL hazard at ${conf * 100}% confidence must trigger verification`
    );
  }
});

test('TEST 2: Anomaly with High Risk (HIGH) and Confidence < 35% triggers Expert Verification', () => {
  const confidences = [0.12, 0.20, 0.28, 0.32, 0.345];
  for (const conf of confidences) {
    assert.equal(
      isVerificationEligible('HIGH', conf),
      true,
      `HIGH hazard at ${conf * 100}% confidence must trigger verification`
    );
  }
});

test('TEST 3: Anomaly with Confidence >= 35% does NOT trigger Expert Verification', () => {
  const confidences = [0.35, 0.40, 0.55, 0.70, 0.75, 0.85, 0.95];
  for (const conf of confidences) {
    assert.equal(
      isVerificationEligible('HIGH', conf),
      false,
      `HIGH hazard at ${conf * 100}% confidence must NOT trigger verification`
    );
    assert.equal(
      isVerificationEligible('CRITICAL', conf),
      false,
      `CRITICAL hazard at ${conf * 100}% confidence must NOT trigger verification`
    );
  }
});

test('TEST 4: LOW and MEDIUM anomalies with confidence < 35% do NOT trigger Expert Verification', () => {
  const confidences = [0.05, 0.15, 0.25, 0.34];
  for (const conf of confidences) {
    assert.equal(isVerificationEligible('LOW', conf), false, `LOW at ${conf} must be false`);
    assert.equal(isVerificationEligible('MEDIUM', conf), false, `MEDIUM at ${conf} must be false`);
  }
});

test('TEST 5: Confirm Expert Verification marks target CONFIRMED, updates KPI, and preserves telemetry', () => {
  const lowConfCriticalTarget = {
    id: 'det_mine_001',
    target_class: 'mine_cylinder',
    hazard_risk: 'CRITICAL',
    confidence: 0.28, // Below 35%
    bbox: [120, 150, 60, 45],
    dimensions: { length_m: 1.8, width_m: 0.6, relief_height_m: 0.5, estimated_area_sqm: 1.08 },
    geolocation: { lat: 18.922, lon: 72.834 },
    shadow_evidence: 'SUPPORTING',
  };

  const state0 = createMockState([lowConfCriticalTarget]);
  assert.equal(isVerificationEligible(lowConfCriticalTarget.hazard_risk, lowConfCriticalTarget.confidence), true);

  // User clicks "Confirm Target (Expert Verified)"
  const state1 = reducer(state0, {
    type: 'CONFIRM_EXPERT_VERIFICATION',
    payload: { detectionId: 'det_mine_001' },
  });

  const verifiedDet = state1.result.detections[0];
  assert.equal(verifiedDet.expert_verified, true);
  assert.equal(verifiedDet.expert_status, 'CONFIRMED');
  assert.equal(verifiedDet.confidence, 0.28, 'Original AI confidence preserved');
  assert.equal(verifiedDet.dimensions.length_m, 1.8, 'Dimensions preserved');
  assert.equal(verifiedDet.geolocation.lat, 18.922, 'Geolocation preserved');
  assert.equal(state1.result.kpis.verified_3d_targets, 1, 'KPI verified count incremented to 1');
});

test('TEST 6: Reject Anomaly ("Nothing There") removes detection from active map and decrements counts', () => {
  const targetA = { id: 'det_001', target_class: 'mine_cylinder', hazard_risk: 'CRITICAL', confidence: 0.22 };
  const targetB = { id: 'det_002', target_class: 'shipwreck', hazard_risk: 'HIGH', confidence: 0.88 };

  const state0 = createMockState([targetA, targetB]);
  assert.equal(state0.result.detections.length, 2);
  assert.equal(state0.result.kpis.critical_hazards, 1);

  // User clicks "Reject Anomaly (Nothing There)" on targetA
  const state1 = reducer(state0, {
    type: 'REJECT_DETECTION',
    payload: { detectionId: 'det_001' },
  });

  assert.equal(state1.result.detections.length, 1);
  assert.equal(state1.result.detections[0].id, 'det_002');
  assert.equal(state1.result.kpis.total_detections, 1);
  assert.equal(state1.result.kpis.critical_hazards, 0, 'Critical hazard count decremented');
});

test('TEST 7: Skip leaves detection unchanged in active results', () => {
  const target = { id: 'det_skip_001', target_class: 'submarine_pipeline', hazard_risk: 'HIGH', confidence: 0.31 };
  const state0 = createMockState([target]);

  // User clicks "Skip"
  const state1 = reducer(state0, {
    type: 'SKIP_EXPERT_VERIFICATION',
    payload: { detectionId: 'det_skip_001' },
  });

  assert.equal(state1.result.detections.length, 1);
  assert.equal(state1.result.detections[0].expert_status, 'SKIPPED');
  assert.equal(state1.result.detections[0].expert_verified, undefined);
  assert.equal(state1.result.detections[0].confidence, 0.31);
});
