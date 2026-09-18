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
  FileImage,
} from 'lucide-react';
import L from 'leaflet';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS } from '../../utils/colorScale';
import { formatCoord } from '../../utils/formatters';
import {
  buildSurveyFrames,
  filterSurveyFrames,
  getObservationStats,
  isValidCoordinate,
} from '../../utils/spatialObservations';
import { DENSITY_CONFIG } from '../../utils/spatialClustering';
import type { SurveyFrame, ClusterInfo, HazardRisk, TargetClass } from '../../types/sonar';
import { LeafletHeatLayer } from './LeafletHeatLayer';
import { MarkerClusterGroup } from './MarkerClusterGroup';

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
 * Auto-fitter component that smoothly zooms and frames analyzed survey frames
 * when new survey observations arrive.
 */
function MapAutoFitter({
  frames,
  isSimulation,
}: {
  frames: SurveyFrame[];
  isSimulation: boolean;
}) {
  const map = useMap();
  const prevCountRef = useRef<number>(0);

  useEffect(() => {
    if (!isSimulation && frames.length > 0 && frames.length !== prevCountRef.current) {
      prevCountRef.current = frames.length;
      const valid = frames.filter((f) => isValidCoordinate(f.geolocation));
      if (valid.length > 0) {
        if (valid.length === 1) {
          map.setView([valid[0].geolocation!.lat, valid[0].geolocation!.lon], 13, { animate: true });
        } else {
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          valid.forEach((f) => {
            const g = f.geolocation!;
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
  }, [frames, isSimulation, map]);

  return null;
}

/**
 * Zoom-aware Map Observation Engine:
 * - Zoom 0–11: Real Canvas Heatmap (@linkurious/leaflet-heat)
 * - Zoom 12–14: Clustered SurveyFrame markers
 * - Zoom 15+: Individual SurveyFrame markers (with spiderfying)
 */
function MapObservationLayer({
  frames,
  showHeatmap,
  onSelectFrame,
  onSelectCluster,
}: {
  frames: SurveyFrame[];
  showHeatmap: boolean;
  onSelectFrame: (frame: SurveyFrame) => void;
  onSelectCluster: (cluster: ClusterInfo) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setZoom(map.getZoom()),
  });

  const isLowZoomHeatmapOnly = zoom <= 11;

  // Transform frames to heat points: exactly 1 heat point per SurveyFrame
  const heatPoints = useMemo(() => {
    return frames
      .filter((f) => isValidCoordinate(f.geolocation))
      .map((f) => ({
        lat: f.geolocation!.lat,
        lon: f.geolocation!.lon,
        weight: f.heatWeight,
      }));
  }, [frames]);

  return (
    <>
      {/* 1. Zoom 0-11: Real Canvas Heatmap Layer */}
      {showHeatmap && isLowZoomHeatmapOnly && (
        <LeafletHeatLayer points={heatPoints} />
      )}

      {/* 2. Zoom 12+: Clustered (12-14) / Individual Tactical Frame Markers (15+) */}
      {!isLowZoomHeatmapOnly && (
        <MarkerClusterGroup
          frames={frames}
          onSelectFrame={onSelectFrame}
          onSelectCluster={onSelectCluster}
        />
      )}
    </>
  );
}

export function MissionMap() {
  const { state, dispatch } = useAppContext();
  const [showHeatmap, setShowHeatmap] = useState(true);

  const isSimulation = state.isSimulationMode || state.uploadMode === 'folder';
  const userLoc = state.userLocation;
  const subLoc = state.currentSubmarineLocation;

  // Build image-level SurveyFrame observations (1 frame per analyzed image)
  const allSurveyFrames = useMemo(() => buildSurveyFrames(state), [state]);

  // Apply map filter state
  const filteredFrames = useMemo(() => {
    return filterSurveyFrames(allSurveyFrames, state.mapFilters);
  }, [allSurveyFrames, state.mapFilters]);

  const stats = useMemo(() => getObservationStats(filteredFrames), [filteredFrames]);

  // Base route coordinates
  const baseRouteCoords = state.simulatedBaseRoute.map((p): [number, number] => [p.lat, p.lon]);
  // Progressively growing RED travelled path
  const travelledCoords = state.travelledRoute.map((p): [number, number] => [p.lat, p.lon]);

  // Center calculation
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
  } else if (filteredFrames.length > 0) {
    const validFrame = filteredFrames.find((f) => isValidCoordinate(f.geolocation));
    if (validFrame?.geolocation) {
      mapCenter = [validFrame.geolocation.lat, validFrame.geolocation.lon];
      panTarget = [validFrame.geolocation.lat, validFrame.geolocation.lon];
    }
  }

  const handleSelectFrame = (frame: SurveyFrame) => {
    dispatch({ type: 'SELECT_FRAME', payload: { frameId: frame.id, frame } });
  };

  const handleSelectCluster = (cluster: ClusterInfo) => {
    dispatch({ type: 'SELECT_CLUSTER', payload: cluster });
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

          {/* Reset Filters button */}
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

          {/* Observation & Anomaly Counter Badge */}
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
            <FileImage size={11} color="#0284c7" />
            <span>
              {filteredFrames.length} Frames
              {filteredFrames.length !== allSurveyFrames.length
                ? ` / ${allSurveyFrames.length}`
                : ''}{' '}
              ({stats.totalAnomalies} Anomalies)
            </span>
          </div>
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={isSimulation ? 6 : filteredFrames.length > 0 ? 12 : userLoc ? 12 : 6}
        style={{ width: '100%', height: '100%', background: '#a5cbe6' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        <MapViewController center={panTarget} />

        {/* Smooth auto-framer when new survey observations arrive */}
        <MapAutoFitter frames={filteredFrames} isSimulation={isSimulation} />

        {/* SIMULATION MODE: Base Arabian Sea Route */}
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

        {/* SIMULATION MODE: RED Travelled Path */}
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

        {/* SIMULATION MODE: Start & Destination Waypoints */}
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

        {/* Dynamic Zoom-Aware Map Observation Engine (0-11: Heatmap, 12+: Frame Clusters & Markers) */}
        <MapObservationLayer
          frames={filteredFrames}
          showHeatmap={showHeatmap}
          onSelectFrame={handleSelectFrame}
          onSelectCluster={handleSelectCluster}
        />
      </MapContainer>

      {/* Top right HUD: Telemetry / Hydrographic Status (offset when Sonar toggle is active) */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: state.result ? 92 : 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '4px 10px',
          height: 28,
          boxSizing: 'border-box',
          zIndex: 450,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          transition: 'right 150ms ease',
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
        {filteredFrames.length > 0 && (
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
                Intensity represents surveyed image observation density & significance, not raw bounding boxes:
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
                SURVEY FRAME SEVERITY (MARKERS)
              </div>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => {
                const cnt = filteredFrames.filter((f) => f.highestRisk === r).length;
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
                    <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>{cnt} frames</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Coordinate indicator */}
        {(isSimulation ? subLoc : userLoc || (filteredFrames.length > 0 && filteredFrames[0].geolocation)) && (
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
                : filteredFrames[0]?.geolocation
                ? `${formatCoord(filteredFrames[0].geolocation.lat, true)} · ${formatCoord(filteredFrames[0].geolocation.lon, false)}`
                : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
