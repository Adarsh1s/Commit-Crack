// src/components/map/MissionMap.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import {
  Navigation,
  Radio,
  Filter,
  ShieldAlert,
  Layers,
  RotateCcw,
  Flame,
} from 'lucide-react';
import L from 'leaflet';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS } from '../../utils/colorScale';
import { formatCoord, formatConfidence } from '../../utils/formatters';
import {
  DENSITY_CONFIG,
  clusterDetections,
  getAllActiveDetections,
  filterDetections,
  isValidCoordinate,
  type ClusterInfo,
  type DensityTier,
} from '../../utils/spatialClustering';
import type { Detection, HazardRisk, TargetClass } from '../../types/sonar';

const CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  submarine_pipeline: 'Submarine Pipeline',
  shipwreck: 'Shipwreck',
  ghost_net: 'Ghost Net',
  mine_cylinder: 'Mine / Cylinder',
};

const RISK_FILTER_OPTIONS: { id: HazardRisk | 'ALL' | 'HIGH_RISK_ONLY'; label: string; icon?: boolean }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'HIGH_RISK_ONLY', label: 'High Risk Only', icon: true },
  { id: 'CRITICAL', label: 'Critical' },
  { id: 'HIGH', label: 'High' },
  { id: 'MEDIUM', label: 'Med' },
  { id: 'LOW', label: 'Low' },
];

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div class="location-marker-dot"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createSubmarineIcon(heading: number = 180): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Pulse radar ring -->
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid #0284c7;
          background: rgba(2, 132, 199, 0.2);
          animation: pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <!-- Submarine hull glyph -->
        <div style="
          width: 24px;
          height: 24px;
          background: #0f172a;
          border: 2px solid #38bdf8;
          border-radius: 50% 50% 40% 40%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
          transform: rotate(${heading - 180}deg);
        ">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8;"></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createWaypointIcon(label: string, isStart: boolean): L.DivIcon {
  const bg = isStart ? '#0284c7' : '#15803d';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
      ">
        <div style="
          background: ${bg};
          color: #ffffff;
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.6);
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
          ${label}
        </div>
        <div style="
          width: 6px;
          height: 6px;
          background: ${bg};
          border: 1.5px solid #ffffff;
          border-radius: 50%;
          margin-top: 2px;
        "></div>
      </div>
    `,
    iconSize: [80, 30],
    iconAnchor: [40, 26],
  });
}

/**
 * Acoustic Heatmap radial glow layer rendered under detections & clusters.
 * Blends into a continuous acoustic density heatmap on the chart.
 */
function createHeatmapBlobIcon(densityTier: DensityTier, count: number): L.DivIcon {
  const cfg = DENSITY_CONFIG[densityTier] ?? DENSITY_CONFIG.SPARSE;
  const size = count >= 15 ? 130 : count >= 8 ? 100 : count >= 4 ? 80 : 65;

  return L.divIcon({
    className: 'aqua-heatmap-glow-layer',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: radial-gradient(circle, ${cfg.color}99 0%, ${cfg.color}45 45%, ${cfg.color}15 70%, transparent 100%);
          filter: blur(5px);
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Cluster icon with spatial concentration color coding:
 * Red = High Concentration, Orange = Medium, Yellow = Low, Green = Sparse.
 */
function createClusterIcon(cluster: ClusterInfo): L.DivIcon {
  const cfg = DENSITY_CONFIG[cluster.densityTier] ?? DENSITY_CONFIG.SPARSE;
  const count = cluster.count;
  const size = count >= 50 ? 46 : count >= 15 ? 40 : count >= 6 ? 34 : 30;
  const fontSize = count >= 100 ? 10 : 12;

  return L.divIcon({
    className: 'aqua-cluster-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <!-- Pulsing Halo representing Spatial Concentration -->
        <div style="
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: ${cfg.pulseColor};
          border: 1.5px solid ${cfg.color};
          animation: pulse 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <!-- Center Core -->
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${cfg.color};
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-family: 'Inter', system-ui, sans-serif;
          font-weight: 800;
          font-size: ${fontSize}px;
          letter-spacing: -0.02em;
        ">
          ${count}
        </div>
        ${cluster.expertVerifiedCount > 0 ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            background: #10b981;
            border: 1.5px solid #ffffff;
            border-radius: 50%;
            width: 13px;
            height: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7px;
            color: #ffffff;
            font-weight: 900;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          ">✓</div>
        ` : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Individual anomaly marker colored by Hazard Risk (Critical, High, Medium, Low).
 */
function createDetectionIcon(color: string, isVerified: boolean = false): L.DivIcon {
  return L.divIcon({
    className: 'aqua-detection-marker',
    html: `
      <div style="
        position: relative;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 2px;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          transform: rotate(45deg);
        "></div>
        ${isVerified ? `
          <div style="
            position: absolute;
            top: -3px;
            right: -3px;
            background: #10b981;
            border: 1px solid #ffffff;
            border-radius: 50%;
            width: 10px;
            height: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 6px;
            color: #ffffff;
            font-weight: 900;
          ">✓</div>
        ` : ''}
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function MapViewController({
  center,
}: {
  center?: [number, number] | null;
}) {
  const map = useMap();
  const prevCenter = useRef<string | null>(null);

  useEffect(() => {
    if (center) {
      const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;
      if (key !== prevCenter.current) {
        map.panTo(center, { animate: true, duration: 1.0 });
        prevCenter.current = key;
      }
    }
  }, [center, map]);

  return null;
}

/**
 * Auto-fitter component that smoothly zooms and frames analyzed detections
 * when a sonar image completes processing in single mode.
 */
function MapAutoFitter({
  detections,
  isSimulation,
}: {
  detections: Detection[];
  isSimulation: boolean;
}) {
  const map = useMap();
  const prevCountRef = useRef<number>(0);

  useEffect(() => {
    if (!isSimulation && detections.length > 0 && detections.length !== prevCountRef.current) {
      prevCountRef.current = detections.length;
      const valid = detections.filter((d) => isValidCoordinate(d.geolocation));
      if (valid.length > 0) {
        if (valid.length === 1) {
          map.setView([valid[0].geolocation!.lat, valid[0].geolocation!.lon], 13, { animate: true });
        } else {
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          valid.forEach((d) => {
            const g = d.geolocation!;
            if (g.lat < minLat) minLat = g.lat;
            if (g.lat > maxLat) maxLat = g.lat;
            if (g.lon < minLon) minLon = g.lon;
            if (g.lon > maxLon) maxLon = g.lon;
          });
          const latDiff = maxLat - minLat;
          const lonDiff = maxLon - minLon;
          if (latDiff < 0.001 && lonDiff < 0.001) {
            map.setView([(minLat + maxLat) / 2, (minLon + maxLon) / 2], 13, { animate: true });
          } else {
            map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [50, 50], maxZoom: 15, animate: true });
          }
        }
      }
    }
  }, [detections, isSimulation, map]);

  return null;
}

/**
 * Sub-component to manage map zoom listening and render dynamic heatmap/clusters/markers.
 */
function MapClusterLayer({
  filteredDetections,
  showHeatmap,
  onSelectCluster,
  onSelectDetection,
}: {
  filteredDetections: Detection[];
  showHeatmap: boolean;
  onSelectCluster: (cluster: ClusterInfo) => void;
  onSelectDetection: (id: string) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
    moveend: () => {
      setZoom(map.getZoom());
    },
  });

  const clusterItems = useMemo(() => {
    return clusterDetections(filteredDetections, zoom);
  }, [filteredDetections, zoom]);

  const handleClusterClick = (cluster: ClusterInfo) => {
    onSelectCluster(cluster);
    const latSpan = Math.abs(cluster.bounds.maxLat - cluster.bounds.minLat);
    const lonSpan = Math.abs(cluster.bounds.maxLon - cluster.bounds.minLon);

    if (latSpan < 0.0001 && lonSpan < 0.0001) {
      // Coincident points: zoom in by 2 levels
      map.setView([cluster.center.lat, cluster.center.lon], Math.min(map.getZoom() + 2, 18), {
        animate: true,
      });
    } else {
      map.fitBounds(
        [
          [cluster.bounds.minLat, cluster.bounds.minLon],
          [cluster.bounds.maxLat, cluster.bounds.maxLon],
        ],
        { padding: [60, 60], maxZoom: 18, animate: true }
      );
    }
  };

  return (
    <>
      {/* 1. ACOUSTIC DENSITY HEATMAP LAYER */}
      {showHeatmap &&
        clusterItems.map((item) => {
          if (item.isCluster) {
            const c = item.cluster;
            return (
              <Marker
                key={`heat-${c.id}`}
                position={[c.center.lat, c.center.lon]}
                icon={createHeatmapBlobIcon(c.densityTier, c.count)}
                interactive={false}
              />
            );
          } else {
            const det = item.detection;
            const geo = det.geolocation!;
            return (
              <Marker
                key={`heat-${det.id}`}
                position={[geo.lat, geo.lon]}
                icon={createHeatmapBlobIcon('SPARSE', 1)}
                interactive={false}
              />
            );
          }
        })}

      {/* 2. TACTICAL CLUSTERS & ANOMALY MARKERS */}
      {clusterItems.map((item) => {
        if (item.isCluster) {
          const c = item.cluster;
          const density = DENSITY_CONFIG[c.densityTier] ?? DENSITY_CONFIG.SPARSE;
          return (
            <Marker
              key={c.id}
              position={[c.center.lat, c.center.lon]}
              icon={createClusterIcon(c)}
              eventHandlers={{
                click: () => handleClusterClick(c),
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', padding: 4, minWidth: 170 }}>
                  <div style={{ fontWeight: 800, color: density.color, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{density.label}</span>
                    <span style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>
                      {c.count} targets
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 2 }}>
                    Density Tier: <strong style={{ color: density.color }}>{c.densityTier}</strong>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 6 }}>
                    Max Danger: <strong style={{ color: RISK_COLORS[c.highestRisk] }}>{c.highestRisk}</strong>
                    {c.expertVerifiedCount > 0 && ` · ${c.expertVerifiedCount} Verified`}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClusterClick(c)}
                    style={{
                      width: '100%',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '5px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Zoom & Inspect Cluster ({c.count})
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        } else {
          const det = item.detection;
          const geo = det.geolocation!;
          return (
            <Marker
              key={det.id}
              position={[geo.lat, geo.lon]}
              icon={createDetectionIcon(RISK_COLORS[det.hazard_risk], !!det.expert_verified)}
              eventHandlers={{
                click: () => onSelectDetection(det.id),
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', padding: 4, minWidth: 180 }}>
                  <div style={{ color: RISK_COLORS[det.hazard_risk], fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{CLASS_LABELS[det.target_class] ?? det.target_class.toUpperCase()} · {det.hazard_risk}</span>
                    {det.expert_verified && (
                      <span style={{ fontSize: '0.55rem', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 4, border: '1px solid #86efac' }}>
                        EXPERT VERIFIED
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>Confidence: {formatConfidence(det.confidence)}</div>
                  <div style={{ color: '#64748b' }}>Size: {det.dimensions.length_m.toFixed(1)}m × {det.dimensions.width_m.toFixed(1)}m</div>
                  <div style={{ marginTop: 4, color: '#94a3b8', fontSize: '0.7rem' }}>
                    {formatCoord(geo.lat, true)} · {formatCoord(geo.lon, false)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectDetection(det.id)}
                    style={{
                      marginTop: 6,
                      width: '100%',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '5px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Open Target Details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        }
      })}
    </>
  );
}

export function MissionMap() {
  const { state, dispatch } = useAppContext();
  const [showHeatmap, setShowHeatmap] = useState(true);

  const isSimulation = state.isSimulationMode || state.uploadMode === 'folder';
  const userLoc = state.userLocation;
  const subLoc = state.currentSubmarineLocation;

  // Aggregate all active detections across single image and folder/batch records
  const allActiveDetections = useMemo(() => getAllActiveDetections(state), [state]);

  // Apply active map filters
  const filteredDetections = useMemo(() => {
    return filterDetections(allActiveDetections, state.mapFilters);
  }, [allActiveDetections, state.mapFilters]);

  // Base route coordinates
  const baseRouteCoords = state.simulatedBaseRoute.map((p): [number, number] => [p.lat, p.lon]);
  // Progressively growing RED travelled path
  const travelledCoords = state.travelledRoute.map((p): [number, number] => [p.lat, p.lon]);

  // Center logic
  let mapCenter: [number, number] = [15.2993, 73.7240]; // Arabian Sea corridor center
  let panTarget: [number, number] | null = null;

  if (isSimulation) {
    if (subLoc) {
      panTarget = [subLoc.lat, subLoc.lon];
    } else if (baseRouteCoords.length > 0) {
      mapCenter = baseRouteCoords[0];
    }
  } else if (userLoc) {
    mapCenter = [userLoc.lat, userLoc.lon];
    panTarget = [userLoc.lat, userLoc.lon];
  } else if (filteredDetections.length > 0) {
    // If detections exist from an uploaded/analyzed image, center on them!
    const validDet = filteredDetections.find((d) => d.geolocation && isValidCoordinate(d.geolocation));
    if (validDet?.geolocation) {
      mapCenter = [validDet.geolocation.lat, validDet.geolocation.lon];
      panTarget = [validDet.geolocation.lat, validDet.geolocation.lon];
    }
  }

  const handleSelectCluster = (cluster: ClusterInfo) => {
    dispatch({ type: 'SELECT_CLUSTER', payload: cluster });
  };

  const handleSelectDetection = (id: string) => {
    dispatch({ type: 'SELECT_DETECTION', payload: id });
  };

  const isFiltered = state.mapFilters.risk !== 'ALL' || state.mapFilters.targetClass !== 'ALL';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Tactical Crosshair HUD */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 400,
          width: 60,
          height: 60,
          opacity: 0.35,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 29, width: 2, height: 16, background: '#0284c7' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 29, width: 2, height: 16, background: '#0284c7' }} />
        <div style={{ position: 'absolute', top: 29, left: 0, width: 16, height: 2, background: '#0284c7' }} />
        <div style={{ position: 'absolute', top: 29, right: 0, width: 16, height: 2, background: '#0284c7' }} />
        <div
          style={{
            position: 'absolute',
            inset: 18,
            border: '1.5px dashed rgba(2, 132, 199, 0.7)',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Top Left: Interactive Spatial, Risk & Heatmap Filter Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 450,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxWidth: 'calc(100% - 380px)',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '6px 10px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {/* Heatmap Toggle Pill */}
          <button
            type="button"
            onClick={() => setShowHeatmap((prev) => !prev)}
            title="Toggle acoustic density heatmap layer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              border: showHeatmap ? '1px solid #f97316' : '1px solid #e2e8f0',
              background: showHeatmap ? '#fff7ed' : '#ffffff',
              color: showHeatmap ? '#ea580c' : '#64748b',
              fontWeight: 800,
              fontSize: '0.65rem',
              padding: '3px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: showHeatmap ? '0 1px 4px rgba(234, 88, 12, 0.15)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            <Flame size={12} color={showHeatmap ? '#ea580c' : '#94a3b8'} />
            <span>Heatmap: {showHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 2px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0f172a', fontWeight: 800, fontSize: '0.68rem', marginRight: 2 }}>
            <Filter size={11} color="#0284c7" />
            <span>RISK:</span>
          </div>

          {/* Quick Risk Pills */}
          {RISK_FILTER_OPTIONS.map((item) => {
            const active = state.mapFilters.risk === item.id;
            const isHighRiskOnly = item.id === 'HIGH_RISK_ONLY';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_MAP_FILTERS',
                    payload: { risk: item.id },
                  })
                }
                style={{
                  border: isHighRiskOnly
                    ? active
                      ? '1px solid #dc2626'
                      : '1px solid #fca5a5'
                    : active
                    ? '1px solid #0284c7'
                    : '1px solid #e2e8f0',
                  background: isHighRiskOnly
                    ? active
                      ? '#fee2e2'
                      : '#ffffff'
                    : active
                    ? '#e0f2fe'
                    : '#ffffff',
                  color: isHighRiskOnly
                    ? '#b91c1c'
                    : active
                    ? '#0369a1'
                    : '#475569',
                  fontWeight: active ? 800 : 600,
                  fontSize: '0.65rem',
                  padding: '3px 7px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  transition: 'all 150ms ease',
                }}
              >
                {item.icon && <ShieldAlert size={10} color="#b91c1c" />}
                {item.label}
              </button>
            );
          })}

          <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 2px' }} />

          {/* Target Class Dropdown */}
          <select
            value={state.mapFilters.targetClass}
            onChange={(e) =>
              dispatch({
                type: 'SET_MAP_FILTERS',
                payload: { targetClass: e.target.value as TargetClass | 'ALL' },
              })
            }
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: '0.65rem',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">All Classes</option>
            {Object.entries(CLASS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Reset Filters button if filtered */}
          {isFiltered && (
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: 'SET_MAP_FILTERS',
                  payload: { risk: 'ALL', targetClass: 'ALL' },
                })
              }
              title="Reset map filters"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '3px 6px',
                fontSize: '0.62rem',
                color: '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}

          {/* Detections Counter Badge */}
          <div
            style={{
              marginLeft: 'auto',
              fontSize: '0.62rem',
              color: '#64748b',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Layers size={11} color="#64748b" />
            <span>
              {filteredDetections.length}
              {filteredDetections.length !== allActiveDetections.length
                ? ` / ${allActiveDetections.length}`
                : ''}{' '}
              Targets
            </span>
          </div>
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={isSimulation ? 6 : filteredDetections.length > 0 ? 12 : userLoc ? 12 : 6}
        style={{ width: '100%', height: '100%', background: '#a5cbe6' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        <MapViewController center={panTarget} />

        {/* Smooth auto-framer when new detections arrive from analyzed image */}
        <MapAutoFitter detections={filteredDetections} isSimulation={isSimulation} />

        {/* SIMULATION MODE: Base Arabian Sea Route (Dashed cyan/navy track) */}
        {isSimulation && baseRouteCoords.length > 1 && (
          <Polyline
            positions={baseRouteCoords}
            pathOptions={{
              color: '#0284c7',
              weight: 3,
              dashArray: '6, 8',
              opacity: 0.6,
            }}
          />
        )}

        {/* SIMULATION MODE: Progressively Highlighted RED Travelled Path */}
        {isSimulation && travelledCoords.length > 1 && (
          <Polyline
            key={`travelled-path-${travelledCoords.length}`}
            positions={travelledCoords}
            pathOptions={{
              color: '#ef4444',
              weight: 4.5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* SIMULATION MODE: Start (Mumbai) & Destination (Kochi) Waypoint Badges */}
        {isSimulation && baseRouteCoords.length > 0 && (
          <>
            <Marker
              position={baseRouteCoords[0]}
              icon={createWaypointIcon('MUMBAI ANCHORAGE', true)}
            />
            <Marker
              position={baseRouteCoords[baseRouteCoords.length - 1]}
              icon={createWaypointIcon('KOCHI NAVAL PORT', false)}
            />
          </>
        )}

        {/* SIMULATION MODE: Live Submarine Marker */}
        {isSimulation && (
          <Marker
            key={`sub-${subLoc ? `${subLoc.lat.toFixed(4)}-${subLoc.lon.toFixed(4)}` : 'mumbai'}`}
            position={subLoc ? [subLoc.lat, subLoc.lon] : (baseRouteCoords.length > 0 ? baseRouteCoords[0] : [18.8, 72.6])}
            icon={createSubmarineIcon(subLoc?.heading ?? 180)}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#0284c7', fontWeight: 800, marginBottom: 4, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Radio size={12} />
                  <span>SIMULATED SUBMARINE POSITION</span>
                </div>
                <div style={{ color: '#64748b' }}>{formatCoord(subLoc ? subLoc.lat : 18.8, true)}</div>
                <div style={{ color: '#64748b' }}>{formatCoord(subLoc ? subLoc.lon : 72.6, false)}</div>
                <div style={{ fontSize: '0.68rem', color: '#0f172a', marginTop: 4, fontWeight: 600 }}>
                  Corridor: Mumbai → Kochi Deep Water Sea Transit
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* REAL / LIVE GPS MODE: User / Vessel Location Marker */}
        {!isSimulation && userLoc && (
          <Marker
            position={[userLoc.lat, userLoc.lon]}
            icon={createLocationIcon()}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#0f172a', fontWeight: 800, marginBottom: 4, letterSpacing: '0.04em' }}>📍 REAL VESSEL POSITION</div>
                <div style={{ color: '#64748b' }}>{formatCoord(userLoc.lat, true)}</div>
                <div style={{ color: '#64748b' }}>{formatCoord(userLoc.lon, false)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dynamic Zoom-Aware Acoustic Heatmap Layer, Clusters & Individual Anomaly Markers */}
        <MapClusterLayer
          filteredDetections={filteredDetections}
          showHeatmap={showHeatmap}
          onSelectCluster={handleSelectCluster}
          onSelectDetection={handleSelectDetection}
        />
      </MapContainer>

      {/* Top right HUD: Telemetry / Hydrographic Status */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          padding: '7px 14px',
          zIndex: 450,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Navigation
            size={13}
            color="#0f172a"
            style={{
              transform: `rotate(${isSimulation ? (subLoc?.heading ?? 180) : 45}deg)`,
              transition: 'transform 300ms ease',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 800 }}>
            {isSimulation ? `${Math.round(subLoc?.heading ?? 180)}° SEA CORRIDOR` : '045° TRUE'}
          </span>
        </div>
        <div style={{ width: 1, height: 14, background: '#e2e8f0' }} />
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
          {isSimulation
            ? state.batchProgress
              ? `Processing ${state.batchProgress.sequence} / ${state.batchProgress.total} · ${(state.params.test_interval_seconds ?? 2.0).toFixed(1)}s Gap`
              : `Arabian Sea Submarine Transit (${state.batchFiles.length} Frames · ${(state.params.test_interval_seconds ?? 2.0).toFixed(1)}s Gap)`
            : 'Hydrographic Ocean Chart'}
        </span>
      </div>

      {/* Bottom left HUD: Spatial Concentration Legend vs Hazard Classification & Coordinates */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 450,
        }}
      >
        {/* Dual Legend Card */}
        {filteredDetections.length > 0 && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '10px 14px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              minWidth: 220,
            }}
          >
            {/* SPATIAL CONCENTRATION SECTION */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.62rem', color: '#0f172a', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>SPATIAL CONCENTRATION (HEATMAP)</span>
                <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 600 }}>DENSITY</span>
              </div>
              <div style={{ fontSize: '0.58rem', color: '#64748b', marginBottom: 6 }}>
                Colors indicate geographic count, not hazard level:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                {(['HIGH', 'MEDIUM', 'LOW', 'SPARSE'] as const).map((tier) => {
                  const cfg = DENSITY_CONFIG[tier];
                  return (
                    <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: cfg.color,
                          border: '1px solid #ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '0.62rem', color: '#334155', fontWeight: 700 }}>
                        {tier === 'HIGH' && '🔴 High (≥15)'}
                        {tier === 'MEDIUM' && '🟠 Med (8-14)'}
                        {tier === 'LOW' && '🟡 Low (4-7)'}
                        {tier === 'SPARSE' && '🟢 Sparse (2-3)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ width: '100%', height: 1, background: '#e2e8f0', margin: '6px 0 8px' }} />

            {/* HAZARD CLASSIFICATION SECTION */}
            <div>
              <div style={{ fontSize: '0.62rem', color: '#0f172a', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 6 }}>
                HAZARD CLASSIFICATION (MARKERS)
              </div>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => {
                const cnt = filteredDetections.filter((d) => d.hazard_risk === r).length;
                if (cnt === 0) return null;
                return (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: RISK_COLORS[r],
                        transform: 'rotate(45deg)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '0.68rem', color: RISK_COLORS[r], fontWeight: 700 }}>{r}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Coordinate indicator */}
        {(isSimulation ? subLoc : userLoc || (filteredDetections.length > 0 && filteredDetections[0].geolocation)) && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: '7px 14px',
              fontSize: '0.72rem',
              color: '#0f172a',
              fontWeight: 600,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
            }}
          >
            <span style={{ color: isSimulation ? '#0284c7' : '#0f172a', fontWeight: 800 }}>
              {isSimulation ? 'SIMULATED SUBMARINE GPS' : 'GPS FIX'}
            </span>
            <span style={{ color: '#64748b' }}>
              {isSimulation && subLoc
                ? `${formatCoord(subLoc.lat, true)} · ${formatCoord(subLoc.lon, false)}`
                : userLoc
                ? `${formatCoord(userLoc.lat, true)} · ${formatCoord(userLoc.lon, false)}`
                : filteredDetections[0]?.geolocation
                ? `${formatCoord(filteredDetections[0].geolocation.lat, true)} · ${formatCoord(filteredDetections[0].geolocation.lon, false)}`
                : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
