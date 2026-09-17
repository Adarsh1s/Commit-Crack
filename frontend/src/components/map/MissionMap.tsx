// src/components/map/MissionMap.tsx
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Compass, Navigation, Anchor, ShieldAlert, Radio } from 'lucide-react';
import L from 'leaflet';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS } from '../../utils/colorScale';
import { formatCoord, formatConfidence } from '../../utils/formatters';
import type { Detection, GeoCoordinate } from '../../types/sonar';

const CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  submarine_pipeline: 'Submarine Pipeline',
  shipwreck: 'Shipwreck',
  ghost_net: 'Ghost Net',
  mine_cylinder: 'Mine / Cylinder',
};

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

function createDetectionIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 2px;
        background: ${color};
        border: 2px solid #020c18;
        box-shadow: 0 0 10px ${color}aa;
        transform: rotate(45deg);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function MapViewController({
  center,
  bounds,
}: {
  center?: [number, number] | null;
  bounds?: L.LatLngBoundsExpression | null;
}) {
  const map = useMap();
  const prevCenter = useRef<string | null>(null);

  useEffect(() => {
    if (center) {
      const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;
      if (key !== prevCenter.current) {
        map.panTo(center, { animate: true, duration: 1.2 });
        prevCenter.current = key;
      }
    }
  }, [center, map]);

  return null;
}

export function MissionMap() {
  const { state, dispatch } = useAppContext();
  const isSimulation = state.isSimulationMode || state.uploadMode === 'folder';
  const detections = state.result?.detections ?? [];
  const userLoc = state.userLocation;
  const subLoc = state.currentSubmarineLocation;

  // Base route coordinates
  const baseRouteCoords = state.simulatedBaseRoute.map((p): [number, number] => [p.lat, p.lon]);
  // Progressively growing RED travelled path
  const travelledCoords = state.travelledRoute.map((p): [number, number] => [p.lat, p.lon]);

  // Center logic
  let mapCenter: [number, number] = [14.5, 74.0]; // Arabian Sea corridor center
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
  }

  const geoDetections = detections.filter(
    (d): d is Detection & { geolocation: NonNullable<Detection['geolocation']> } =>
      d.geolocation != null
  );

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

      <MapContainer
        center={mapCenter}
        zoom={isSimulation ? 6 : userLoc ? 12 : 3}
        style={{ width: '100%', height: '100%', background: '#a5cbe6' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        <MapViewController center={panTarget} />

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

        {/* Acoustic Detections Markers */}
        {geoDetections.map((det) => (
          <Marker
            key={det.id}
            position={[det.geolocation.lat, det.geolocation.lon]}
            icon={createDetectionIcon(RISK_COLORS[det.hazard_risk])}
            eventHandlers={{
              click: () => dispatch({ type: 'SELECT_DETECTION', payload: det.id }),
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: RISK_COLORS[det.hazard_risk], fontWeight: 800, marginBottom: 4 }}>
                  {CLASS_LABELS[det.target_class] ?? det.target_class.toUpperCase()} · {det.hazard_risk}
                </div>
                <div style={{ color: '#0f172a', fontWeight: 600 }}>Confidence: {formatConfidence(det.confidence)}</div>
                <div style={{ color: '#64748b' }}>Size: {det.dimensions.length_m.toFixed(1)}m × {det.dimensions.width_m.toFixed(1)}m</div>
                <div style={{ marginTop: 4, color: '#94a3b8', fontSize: '0.7rem' }}>
                  {formatCoord(det.geolocation.lat, true)} · {formatCoord(det.geolocation.lon, false)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
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

      {/* Bottom left HUD: Hazard classification & Coordinates */}
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
        {geoDetections.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '10px 14px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6 }}>
              HAZARD CLASSIFICATION
            </div>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((r) => {
              const cnt = detections.filter((d) => d.hazard_risk === r).length;
              if (cnt === 0) return null;
              return (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: RISK_COLORS[r] }} />
                  <span style={{ fontSize: '0.68rem', color: RISK_COLORS[r], fontWeight: 700 }}>{r}</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>{cnt}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Coordinate indicator */}
        {(isSimulation ? subLoc : userLoc) && (
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
                : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
