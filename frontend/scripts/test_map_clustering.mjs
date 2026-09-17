// frontend/scripts/test_map_clustering.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Density configuration strictly representing spatial concentration
const DENSITY_CONFIG = {
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

function isValidCoordinate(geo) {
  if (!geo) return false;
  const { lat, lon } = geo;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  // Exclude [0, 0] null-island default
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  return true;
}

function projectLatLngToPixel(lat, lon, zoom) {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const clampedSinY = Math.min(Math.max(sinY, -0.9999), 0.9999);
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + clampedSinY) / (1 - clampedSinY)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function calculateDensityTier(count, bounds) {
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

function filterDetections(detections, filters) {
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

function clusterDetections(detections, zoom, clusterRadiusPx = 65, maxClusterZoom = 15) {
  const validDets = detections.filter((d) => isValidCoordinate(d.geolocation));
  if (validDets.length === 0) return [];

  // If zoom is very deep, resolve directly into individual markers
  if (zoom >= maxClusterZoom) {
    return validDets.map((d) => ({ isCluster: false, detection: d }));
  }

  // Project all detections to pixel coordinates at this zoom
  const projected = validDets.map((d) => {
    const geo = d.geolocation;
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

  const clusters = [];

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
      let sumLat = 0;
      let sumLon = 0;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLon = Infinity;
      let maxLon = -Infinity;

      const clusterDets = [];
      const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      const classCounts = {};
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

      let highestRisk = 'LOW';
      if (riskCounts.CRITICAL > 0) highestRisk = 'CRITICAL';
      else if (riskCounts.HIGH > 0) highestRisk = 'HIGH';
      else if (riskCounts.MEDIUM > 0) highestRisk = 'MEDIUM';

      const bounds = { minLat, maxLat, minLon, maxLon };
      const densityTier = calculateDensityTier(group.length, bounds);

      const clusterInfo = {
        id: `cluster-${zoom}-${Math.round(meanLat * 1000)}-${Math.round(meanLon * 1000)}-${group.length}`,
        center: { lat: meanLat, lon: meanLon },
        bounds,
        count: group.length,
        densityTier,
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

function getAllActiveDetections(state) {
  const all = [];
  const seenKeys = new Set();

  if (state.uploadMode === 'folder' && state.batchResults && state.batchResults.length > 0) {
    for (let rIdx = 0; rIdx < state.batchResults.length; rIdx++) {
      const rec = state.batchResults[rIdx];
      if (rec.detections && rec.detections.length > 0) {
        for (let dIdx = 0; dIdx < rec.detections.length; dIdx++) {
          const d = rec.detections[dIdx];
          const fname = rec.filename || rec.fileName || `frame_${rIdx}`;
          const uniqueKey = `${fname}_${d.id || dIdx}`;
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            all.push(d);
          }
        }
      }
    }
  }

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

// Helpers for generating test detections
function createMockDetection(id, lat, lon, hazard_risk = 'MEDIUM', target_class = 'mine_cylinder', expert_verified = false) {
  return {
    id,
    target_class,
    hazard_risk,
    confidence: 0.85,
    dimensions: { length_m: 2.5, width_m: 1.0, height_m: 0.8 },
    geolocation: lat != null && lon != null ? { lat, lon } : undefined,
    expert_verified,
    expert_status: expert_verified ? 'CONFIRMED' : 'PENDING',
    shadow_evidence: 'SUPPORTING',
  };
}

// --------------------------------------------------------------------------
// TEST SUITE: 16 COMPREHENSIVE MAP CLUSTERING SCENARIOS
// --------------------------------------------------------------------------

test('1. Single geolocated detection renders as an individual marker, not a cluster', () => {
  const det = createMockDetection('det-1', 15.2, 73.8, 'CRITICAL');
  const result = clusterDetections([det], 8);
  assert.equal(result.length, 1);
  assert.equal(result[0].isCluster, false);
  assert.equal(result[0].detection.id, 'det-1');
});

test('2. 10 nearby detections aggregate into a single cluster', () => {
  const dets = [];
  for (let i = 0; i < 10; i++) {
    // Very close points (~100 meters apart)
    dets.push(createMockDetection(`det-${i}`, 15.200 + i * 0.001, 73.800 + i * 0.001, 'HIGH'));
  }
  const result = clusterDetections(dets, 6);
  assert.equal(result.length, 1);
  assert.equal(result[0].isCluster, true);
  assert.equal(result[0].cluster.count, 10);
  assert.equal(result[0].cluster.detections.length, 10);
});

test('3. 100 detections in one region aggregate into cluster(s) with total count 100', () => {
  const dets = [];
  for (let i = 0; i < 100; i++) {
    dets.push(createMockDetection(`det-${i}`, 15.2 + (i % 10) * 0.002, 73.8 + Math.floor(i / 10) * 0.002, 'LOW'));
  }
  const result = clusterDetections(dets, 6);
  const totalCount = result.reduce((sum, item) => sum + (item.isCluster ? item.cluster.count : 1), 0);
  assert.equal(totalCount, 100);
  // All points in tight bounding box must aggregate into clusters
  assert.ok(result.every((item) => item.isCluster));
});

test('4. 100 spread detections across distinct regions form multiple separate clusters', () => {
  const dets = [];
  // Region A: Mumbai (lat 18.9, lon 72.8) - 50 detections
  for (let i = 0; i < 50; i++) {
    dets.push(createMockDetection(`mumbai-${i}`, 18.9 + (i % 5) * 0.001, 72.8 + Math.floor(i / 5) * 0.001, 'HIGH'));
  }
  // Region B: Kochi (lat 9.9, lon 76.2) - 50 detections
  for (let i = 0; i < 50; i++) {
    dets.push(createMockDetection(`kochi-${i}`, 9.9 + (i % 5) * 0.001, 76.2 + Math.floor(i / 5) * 0.001, 'CRITICAL'));
  }

  const result = clusterDetections(dets, 6);
  assert.equal(result.length, 2, 'Should form exactly 2 separate clusters for distant regions');
  assert.ok(result[0].isCluster && result[1].isCluster);
  assert.equal(result[0].cluster.count, 50);
  assert.equal(result[1].cluster.count, 50);
});

test('5. Zoom-in hierarchy: zoom 5 groups items, zoom 10 splits into sub-clusters', () => {
  // Two sub-groups ~15km apart
  const groupA = [];
  const groupB = [];
  for (let i = 0; i < 5; i++) {
    groupA.push(createMockDetection(`a-${i}`, 15.0 + i * 0.001, 73.5, 'HIGH'));
    groupB.push(createMockDetection(`b-${i}`, 15.15 + i * 0.001, 73.5, 'MEDIUM'));
  }
  const allDets = [...groupA, ...groupB];

  // At wide zoom (e.g. zoom 5), pixel distance is small -> 1 unified cluster
  const wideResult = clusterDetections(allDets, 5, 80);
  assert.equal(wideResult.length, 1);
  assert.equal(wideResult[0].cluster.count, 10);

  // At closer zoom (e.g. zoom 11), pixel distance expands -> splits into 2 sub-clusters
  const splitResult = clusterDetections(allDets, 11, 65);
  assert.equal(splitResult.length, 2);
  assert.equal(splitResult[0].cluster.count, 5);
  assert.equal(splitResult[1].cluster.count, 5);
});

test('6. Deep zoom-in (zoom >= maxClusterZoom) splits clusters into individual markers', () => {
  const dets = [
    createMockDetection('det-1', 15.2001, 73.8001, 'CRITICAL'),
    createMockDetection('det-2', 15.2005, 73.8005, 'HIGH'),
    createMockDetection('det-3', 15.2009, 73.8009, 'LOW'),
  ];
  // Deep zoom (e.g. zoom 16)
  const result = clusterDetections(dets, 16);
  assert.equal(result.length, 3);
  assert.ok(result.every((item) => item.isCluster === false));
  assert.equal(result[0].detection.id, 'det-1');
  assert.equal(result[1].detection.id, 'det-2');
  assert.equal(result[2].detection.id, 'det-3');
});

test('7. Zoom-out hierarchy: individual markers recombine into clusters', () => {
  const dets = [
    createMockDetection('det-1', 15.2001, 73.8001, 'CRITICAL'),
    createMockDetection('det-2', 15.2005, 73.8005, 'HIGH'),
  ];

  const deepZoom = clusterDetections(dets, 16);
  assert.equal(deepZoom.length, 2);
  assert.equal(deepZoom[0].isCluster, false);

  const zoomOut = clusterDetections(dets, 8);
  assert.equal(zoomOut.length, 1);
  assert.equal(zoomOut[0].isCluster, true);
  assert.equal(zoomOut[0].cluster.count, 2);
});

test('8. Spatial Concentration Color Scale strictly represents geographic density, NOT hazard risk', () => {
  // Case A: 2 CRITICAL targets (very high danger, but sparse density)
  const sparseCritical = [
    createMockDetection('c-1', 15.0, 73.0, 'CRITICAL'),
    createMockDetection('c-2', 15.001, 73.001, 'CRITICAL'),
  ];
  const resSparse = clusterDetections(sparseCritical, 8);
  assert.equal(resSparse[0].cluster.densityTier, 'SPARSE');
  assert.equal(DENSITY_CONFIG[resSparse[0].cluster.densityTier].color, '#22c55e', 'Must be GREEN for sparse density');
  assert.equal(resSparse[0].cluster.highestRisk, 'CRITICAL', 'Highest risk recorded separately as CRITICAL');

  // Case B: 5 MEDIUM targets -> LOW density (Yellow)
  const lowDensity = [];
  for (let i = 0; i < 5; i++) {
    lowDensity.push(createMockDetection(`l-${i}`, 15.0 + i * 0.005, 73.0 + i * 0.005, 'MEDIUM'));
  }
  const resLow = clusterDetections(lowDensity, 8);
  assert.equal(resLow[0].cluster.densityTier, 'LOW');
  assert.equal(DENSITY_CONFIG[resLow[0].cluster.densityTier].color, '#eab308', 'Must be YELLOW for low density');

  // Case C: 10 LOW targets -> MEDIUM density (Orange)
  const medDensity = [];
  for (let i = 0; i < 10; i++) {
    medDensity.push(createMockDetection(`m-${i}`, 15.0 + i * 0.002, 73.0 + i * 0.002, 'LOW'));
  }
  const resMed = clusterDetections(medDensity, 8);
  assert.equal(resMed[0].cluster.densityTier, 'MEDIUM');
  assert.equal(DENSITY_CONFIG[resMed[0].cluster.densityTier].color, '#f97316', 'Must be ORANGE for medium density');

  // Case D: 25 LOW hazard targets -> HIGH density (Red)
  const highDensity = [];
  for (let i = 0; i < 25; i++) {
    highDensity.push(createMockDetection(`h-${i}`, 15.0 + i * 0.001, 73.0 + i * 0.001, 'LOW'));
  }
  const resHigh = clusterDetections(highDensity, 8);
  assert.equal(resHigh[0].cluster.densityTier, 'HIGH');
  assert.equal(DENSITY_CONFIG[resHigh[0].cluster.densityTier].color, '#ef4444', 'Must be RED for high concentration');
  assert.equal(resHigh[0].cluster.highestRisk, 'LOW', 'Danger level remains LOW even though cluster is RED');
});

test('9. Filter by HIGH_RISK_ONLY isolates CRITICAL and HIGH detections', () => {
  const detections = [
    createMockDetection('c-1', 15.0, 73.0, 'CRITICAL'),
    createMockDetection('h-1', 15.001, 73.001, 'HIGH'),
    createMockDetection('m-1', 15.002, 73.002, 'MEDIUM'),
    createMockDetection('l-1', 15.003, 73.003, 'LOW'),
  ];
  const filters = { risk: 'HIGH_RISK_ONLY', targetClass: 'ALL' };
  const filtered = filterDetections(detections, filters);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((d) => d.id).sort(), ['c-1', 'h-1']);
});

test('10. Filter by targetClass isolates detections of matching class', () => {
  const detections = [
    createMockDetection('d-1', 15.0, 73.0, 'HIGH', 'mine_cylinder'),
    createMockDetection('d-2', 15.001, 73.001, 'HIGH', 'crab_pot'),
    createMockDetection('d-3', 15.002, 73.002, 'CRITICAL', 'mine_cylinder'),
  ];
  const filters = { risk: 'ALL', targetClass: 'mine_cylinder' };
  const filtered = filterDetections(detections, filters);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((d) => d.id).sort(), ['d-1', 'd-3']);
});

test('11. Expert rejection ("Nothing There") removes detection from active list and clusters immediately', () => {
  let detections = [
    createMockDetection('det-1', 15.0, 73.0, 'CRITICAL'),
    createMockDetection('det-2', 15.001, 73.001, 'HIGH'),
  ];

  // Before rejection: 1 cluster of 2 items
  let res = clusterDetections(detections, 8);
  assert.equal(res.length, 1);
  assert.equal(res[0].isCluster, true);
  assert.equal(res[0].cluster.count, 2);

  // User marks det-1 as "Nothing There"
  detections = detections.filter((d) => d.id !== 'det-1');

  // After rejection: remaining det-2 dissolves into single individual marker
  res = clusterDetections(detections, 8);
  assert.equal(res.length, 1);
  assert.equal(res[0].isCluster, false);
  assert.equal(res[0].detection.id, 'det-2');
});

test('12. Expert confirmation updates verified count inside the cluster', () => {
  const detections = [
    createMockDetection('det-1', 15.0, 73.0, 'CRITICAL', 'mine_cylinder', true), // confirmed
    createMockDetection('det-2', 15.001, 73.001, 'HIGH', 'mine_cylinder', false),
  ];
  const res = clusterDetections(detections, 8);
  assert.equal(res.length, 1);
  assert.equal(res[0].cluster.expertVerifiedCount, 1);
  assert.equal(res[0].cluster.count, 2);
});

test('13. Multi-file/folder batch aggregation skips 0-detection frames cleanly', () => {
  const state = {
    uploadMode: 'folder',
    batchResults: [
      {
        fileName: 'frame_001.png',
        detections: [createMockDetection('f1-1', 15.0, 73.0, 'HIGH')],
      },
      {
        fileName: 'frame_002.png',
        detections: [], // 0 detections in frame
      },
      {
        fileName: 'frame_003.png',
        detections: [createMockDetection('f3-1', 15.001, 73.001, 'CRITICAL')],
      },
    ],
    result: null,
  };

  const activeDets = getAllActiveDetections(state);
  assert.equal(activeDets.length, 2);
  assert.deepEqual(activeDets.map((d) => d.id), ['f1-1', 'f3-1']);

  const res = clusterDetections(activeDets, 8);
  assert.equal(res.length, 1);
  assert.equal(res[0].cluster.count, 2);
});

test('14. Missing, invalid, and [0,0] coordinates are strictly omitted without crashing', () => {
  assert.equal(isValidCoordinate(null), false);
  assert.equal(isValidCoordinate(undefined), false);
  assert.equal(isValidCoordinate({ lat: 0, lon: 0 }), false, 'Null island [0,0] must be rejected');
  assert.equal(isValidCoordinate({ lat: NaN, lon: 73.0 }), false);
  assert.equal(isValidCoordinate({ lat: 15.0, lon: Infinity }), false);
  assert.equal(isValidCoordinate({ lat: 95.0, lon: 73.0 }), false, 'Latitude > 90 must be rejected');

  const messyDetections = [
    createMockDetection('valid-1', 15.0, 73.0),
    createMockDetection('null-island', 0, 0),
    createMockDetection('missing-geo', null, null),
    createMockDetection('nan-geo', NaN, 73.0),
    createMockDetection('valid-2', 15.001, 73.001),
  ];

  const clustered = clusterDetections(messyDetections, 8);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].cluster.count, 2);
  assert.deepEqual(clustered[0].cluster.detections.map((d) => d.id), ['valid-1', 'valid-2']);
});

test('15. Empty state handles empty array gracefully without error', () => {
  const result = clusterDetections([], 8);
  assert.deepEqual(result, []);
});

test('16. High-volume performance: 1,000 detections clustered in < 15ms', () => {
  const largeDets = [];
  for (let i = 0; i < 1000; i++) {
    largeDets.push(
      createMockDetection(
        `perf-${i}`,
        14.0 + (i % 50) * 0.05,
        72.0 + Math.floor(i / 50) * 0.05,
        i % 4 === 0 ? 'CRITICAL' : 'HIGH'
      )
    );
  }

  const start = performance.now();
  const clusters = clusterDetections(largeDets, 7);
  const elapsed = performance.now() - start;

  assert.ok(clusters.length > 0);
  assert.ok(elapsed < 15, `Clustering 1,000 detections took ${elapsed.toFixed(2)}ms (must be < 15ms)`);
});

test('17. Single uploaded image with multiple anomalies produces active heatmap cluster on the map', () => {
  const singleImageState = {
    uploadMode: 'single',
    result: {
      detections: [
        createMockDetection('tgt-01', 15.2994, 73.7238, 'CRITICAL', 'mine_cylinder'),
        createMockDetection('tgt-02', 15.2991, 73.7242, 'HIGH', 'mine_cylinder'),
        createMockDetection('tgt-03', 15.2992, 73.7240, 'HIGH', 'submarine_pipeline'),
      ],
    },
    batchResults: [],
  };

  const activeDets = getAllActiveDetections(singleImageState);
  assert.equal(activeDets.length, 3);

  // At survey zoom (zoom 8), 3 close anomalies in one image must cluster into a single heatmap group
  const clustered = clusterDetections(activeDets, 8);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].isCluster, true);
  assert.equal(clustered[0].cluster.count, 3);
  assert.equal(clustered[0].cluster.highestRisk, 'CRITICAL');
  assert.equal(clustered[0].cluster.densityTier, 'SPARSE');
  assert.equal(DENSITY_CONFIG[clustered[0].cluster.densityTier].color, '#22c55e');
});
