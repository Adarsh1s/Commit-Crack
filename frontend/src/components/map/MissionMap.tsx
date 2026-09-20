// src/components/map/MissionMap.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import {
  Radio,
  Filter,
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
import type { SurveyFrame, ClusterInfo, HazardRisk, TargetClass, GeoCoordinate } from '../../types/sonar';
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

function createWaypointIcon(isStart: boolean): L.DivIcon {
  const bg = isStart ? '#0284c7' : '#15803d';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 10px;
        height: 10px;
        background: ${bg};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 8px ${bg}, 0 2px 4px rgba(0,0,0,0.4);
        pointer-events: none;
      "></div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
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
 * Continuous 60FPS smooth submarine propulsion marker.
 * Smoothly interpolates vessel position and rotational heading without stutter.
 */
function SmoothSubmarineMarker({
  targetLoc,
  routeCoords,
  isProcessing,
  routeInfo,
}: {
  targetLoc: GeoCoordinate | null;
  routeCoords: [number, number][];
  isProcessing: boolean;
  routeInfo?: any;
}) {
  const [currentPos, setCurrentPos] = useState<[number, number]>(() => {
    if (targetLoc) return [targetLoc.lat, targetLoc.lon];
    if (routeCoords.length > 0) return routeCoords[0];
    return [18.8, 72.6];
  });
  const [currentHeading, setCurrentHeading] = useState<number>(() => targetLoc?.heading ?? 180);

  const posRef = useRef<[number, number]>(currentPos);
  const targetRef = useRef<[number, number]>(currentPos);
  const headingRef = useRef<number>(currentHeading);

  useEffect(() => {
    if (targetLoc) {
      targetRef.current = [targetLoc.lat, targetLoc.lon];
      if (typeof targetLoc.heading === 'number') {
        headingRef.current = targetLoc.heading;
      }
    }
  }, [targetLoc]);

  useEffect(() => {
    let animId: number;

    const animate = () => {
      const [curLat, curLon] = posRef.current;
      const [tgtLat, tgtLon] = targetRef.current;

      const dLat = tgtLat - curLat;
      const dLon = tgtLon - curLon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);

      if (dist > 0.00002) {
        const ease = isProcessing ? 0.06 : 0.12;
        const nextLat = curLat + dLat * ease;
        const nextLon = curLon + dLon * ease;
        posRef.current = [nextLat, nextLon];
        setCurrentPos([nextLat, nextLon]);

        const calcHead = (Math.atan2(dLon, dLat) * 180) / Math.PI;
        const targetHead = (calcHead + 360) % 360;
        let diff = (targetHead - headingRef.current + 540) % 360 - 180;
        const nextHead = headingRef.current + diff * 0.1;
        headingRef.current = nextHead;
        setCurrentHeading(nextHead);
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isProcessing]);

  return (
    <Marker
      position={currentPos}
      icon={createSubmarineIcon(currentHeading)}
    >
      <Popup>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#0284c7', fontWeight: 800, marginBottom: 4, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Radio size={12} />
            <span>SUBMARINE PATROL NAVIGATION</span>
          </div>
          <div style={{ color: '#64748b' }}>{formatCoord(currentPos[0], true)}</div>
          <div style={{ color: '#64748b' }}>{formatCoord(currentPos[1], false)}</div>
          <div style={{ fontSize: '0.68rem', color: '#0f172a', marginTop: 4, fontWeight: 600 }}>
            Corridor: {routeInfo?.name || 'Naval Patrol Deep Sea Transit'}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#0284c7', marginTop: 2, fontWeight: 700 }}>
            Continuous Cruise · {Math.round(currentHeading)}°
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * Zoom-aware Map Observation Engine:
 * - Zoom 0–11: Real Canvas Heatmap with merged glowing hotspot clusters
 * - Zoom 12+: Unclusters into individual tactical small circular dots with color based on severity (1 dot = 1 image)
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
      {/* 1. Canvas Heatmap Layer: Radiant glowing thermal hotspot clouds */}
      {showHeatmap && (
        <LeafletHeatLayer points={heatPoints} maxZoom={12} radius={45} blur={25} minOpacity={0.45} />
      )}

      {/* 2. Tactical Markers & Clusters:
             - Zoomed out: All frames in each localized hotspot merge into ONE glowing cluster marker.
             - Zoomed in (zoom >= 12): Automatically splits into individual small circular glowing dots (one dot per image). */}
      <MarkerClusterGroup
        frames={frames}
        onSelectFrame={onSelectFrame}
        onSelectCluster={onSelectCluster}
      />
    </>
  );
}

export function MissionMap() {
  const { state, dispatch } = useAppContext();
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  const isSimulation = state.isSimulationMode || state.uploadMode === 'folder' || !!state.batchProgress;

  // Derive all survey observations and statistics
  const allSurveyFrames = useMemo(() => buildSurveyFrames(state), [state]);
  const filteredFrames = useMemo(
    () => filterSurveyFrames(allSurveyFrames, state.mapFilters),
    [allSurveyFrames, state.mapFilters]
  );
  const stats = useMemo(() => getObservationStats(allSurveyFrames), [allSurveyFrames]);

  const baseRouteCoords = useMemo<[number, number][]>(() => {
    return (state.simulatedBaseRoute || [])
      .map((p: any): [number, number] | null => {
        if (!p) return null;
        const lat = typeof p.lat === 'number' ? p.lat : Array.isArray(p) && typeof p[0] === 'number' ? p[0] : null;
        const lon = typeof p.lon === 'number' ? p.lon : Array.isArray(p) && typeof p[1] === 'number' ? p[1] : null;
        if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
          return [lat, lon];
        }
        return null;
      })
      .filter((c): c is [number, number] => c !== null);
  }, [state.simulatedBaseRoute]);

  const subLoc = state.currentSubmarineLocation;
  const userLoc = state.userLocation;

  let mapCenter: [number, number] = [15.5, 73.0];
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

      {/* Top Bar: Adaptive Spatial, Risk & Heatmap Toolbar (Fits gracefully even in low space) */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: state.result ? 78 : 10,
          zIndex: 450,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '3px 8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'nowrap',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            whiteSpace: 'nowrap',
            height: 32,
            boxSizing: 'border-box',
            maxWidth: '100%',
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
              border: showHeatmap ? '1px solid #f97316' : '1px solid #cbd5e1',
              background: showHeatmap ? '#fff7ed' : '#ffffff',
              color: showHeatmap ? '#ea580c' : '#64748b',
              fontWeight: 800,
              fontSize: '0.65rem',
              padding: '2px 7px',
              borderRadius: 6,
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              boxShadow: showHeatmap ? '0 1px 4px rgba(234, 88, 12, 0.15)' : 'none',
              transition: 'all 150ms ease',
              height: 24,
            }}
          >
            <Flame size={12} color={showHeatmap ? '#ea580c' : '#94a3b8'} />
            <span>Heatmap: {showHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 1px', flexShrink: 0 }} />

          {/* Compact Responsive Risk Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Filter size={11} color="#0284c7" />
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0f172a' }}>RISK:</span>
            <select
              value={state.mapFilters.risk}
              onChange={(e) =>
                dispatch({
                  type: 'SET_MAP_FILTERS',
                  payload: { risk: e.target.value as any },
                })
              }
              style={{
                background:
                  state.mapFilters.risk === 'CRITICAL' || state.mapFilters.risk === 'HIGH_RISK_ONLY'
                    ? '#fee2e2'
                    : state.mapFilters.risk !== 'ALL'
                    ? '#e0f2fe'
                    : '#ffffff',
                border:
                  state.mapFilters.risk === 'CRITICAL' || state.mapFilters.risk === 'HIGH_RISK_ONLY'
                    ? '1px solid #ef4444'
                    : state.mapFilters.risk !== 'ALL'
                    ? '1px solid #0284c7'
                    : '1px solid #cbd5e1',
                color:
                  state.mapFilters.risk === 'CRITICAL' || state.mapFilters.risk === 'HIGH_RISK_ONLY'
                    ? '#b91c1c'
                    : state.mapFilters.risk !== 'ALL'
                    ? '#0369a1'
                    : '#0f172a',
                borderRadius: 6,
                padding: '2px 6px',
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                height: 24,
                flexShrink: 0,
              }}
            >
              <option value="ALL">All Risks</option>
              <option value="HIGH_RISK_ONLY">⚠️ High Risk Only</option>
              <option value="CRITICAL">🔴 Critical</option>
              <option value="HIGH">🟠 High</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="LOW">🟢 Low</option>
            </select>
          </div>

          <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 1px', flexShrink: 0 }} />

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
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: '0.65rem',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              height: 24,
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
                padding: '2px 6px',
                fontSize: '0.62rem',
                color: '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                height: 24,
              }}
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}

          <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 1px', flexShrink: 0 }} />

          {/* Observation & Anomaly Counter Badge */}
          <div
            style={{
              fontSize: '0.65rem',
              color: '#64748b',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
              whiteSpace: 'nowrap',
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
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution=""
          maxZoom={19}
        />

        <MapViewController center={panTarget} />

        {/* Smooth auto-framer when new survey observations arrive */}
        <MapAutoFitter frames={filteredFrames} isSimulation={isSimulation} />

        {/* SIMULATION MODE: Base Route (Dotted corridor line) */}
        {isSimulation && baseRouteCoords.length > 1 && (
          <Polyline
            positions={baseRouteCoords}
            pathOptions={{
              color: '#0284c7',
              weight: 3,
              dashArray: '6, 8',
              opacity: 0.6,
            }}
          >
            <Popup>
              <div style={{ color: '#64748b' }}>
                {isSimulation
                  ? (state.simulationRouteInfo?.name || 'NAVAL PATROL DEEP WATER CORRIDOR').toUpperCase()
                  : 'INDIAN OCEAN MARITIME ZONE'}
              </div>
            </Popup>
          </Polyline>
        )}

        {/* SIMULATION MODE: Start & Destination Waypoints */}
        {isSimulation && baseRouteCoords.length > 0 && (
          <>
            <Marker
              position={baseRouteCoords[0]}
              icon={createWaypointIcon(true)}
            />
            <Marker
              position={baseRouteCoords[baseRouteCoords.length - 1]}
              icon={createWaypointIcon(false)}
            />
          </>
        )}

        {/* SIMULATION MODE: Smooth Continuous Submarine Propulsion Marker */}
        {isSimulation && (
          <SmoothSubmarineMarker
            targetLoc={subLoc}
            routeCoords={baseRouteCoords}
            isProcessing={state.status === 'processing'}
            routeInfo={state.simulationRouteInfo}
          />
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

      {/* Bottom left: Compact Spatial Concentration Legend */}
      {filteredFrames.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 450,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '5px 10px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#334155',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span>🔴 High (≥15)</span>
          <span>🟠 Med (8-14)</span>
          <span>🟡 Low (4-7)</span>
          <span>🟢 Sparse (2-3)</span>
        </div>
      )}
    </div>
  );
}
