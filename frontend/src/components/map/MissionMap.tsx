// src/components/map/MissionMap.tsx
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Compass, Navigation } from 'lucide-react';
import L from 'leaflet';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS } from '../../utils/colorScale';
import { formatCoord, formatConfidence } from '../../utils/formatters';
import type { Detection } from '../../types/sonar';

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

function MapCenterController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const prevCenter = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (center && JSON.stringify(center) !== JSON.stringify(prevCenter.current)) {
      map.flyTo(center, 12, { animate: true, duration: 1.5 });
      prevCenter.current = center;
    }
  }, [center, map]);

  return null;
}

export function MissionMap() {
  const { state, dispatch } = useAppContext();
  const detections = state.result?.detections ?? [];
  const userLoc = state.userLocation;

  const defaultCenter: [number, number] = userLoc
    ? [userLoc.lat, userLoc.lon]
    : [20, 0];

  const geoDetections = detections.filter(
    (d): d is Detection & { geolocation: NonNullable<Detection['geolocation']> } =>
      d.geolocation != null
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Center tactical crosshair HUD */}
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
          opacity: 0.45,
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
        center={defaultCenter}
        zoom={userLoc ? 12 : 3}
        style={{ width: '100%', height: '100%', background: '#a5cbe6' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* Pan to user or first detection */}
        <MapCenterController center={userLoc ? [userLoc.lat, userLoc.lon] : null} />

        {/* User location marker */}
        {userLoc && (
          <Marker
            position={[userLoc.lat, userLoc.lon]}
            icon={createLocationIcon()}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#0f172a', background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#0f172a', fontWeight: 800, marginBottom: 4, letterSpacing: '0.04em' }}>📍 VESSEL POSITION</div>
                <div style={{ color: '#64748b' }}>{formatCoord(userLoc.lat, true)}</div>
                <div style={{ color: '#64748b' }}>{formatCoord(userLoc.lon, false)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Detections markers */}
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

      {/* Top right HUD: Compass / Hydrographic Chart */}
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
          <Navigation size={13} color="#0f172a" style={{ transform: 'rotate(45deg)' }} />
          <span style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 800 }}>
            045° TRUE
          </span>
        </div>
        <div style={{ width: 1, height: 14, background: '#e2e8f0' }} />
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
          Hydrographic Ocean Chart
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
        {userLoc && (
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
            <span style={{ color: '#0f172a', fontWeight: 800 }}>GPS FIX</span>
            <span style={{ color: '#64748b' }}>{formatCoord(userLoc.lat, true)} · {formatCoord(userLoc.lon, false)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
