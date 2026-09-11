// src/components/inspector/TargetDrawer.tsx
import React from 'react';
import { X, ShieldCheck, ShieldOff, Minus, MapPin, Ruler } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS, confidenceToColor } from '../../utils/colorScale';
import { formatConfidence, formatCoord, formatDimension, formatArea } from '../../utils/formatters';
import type { Detection } from '../../types/sonar';

const CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  ghost_gear: 'Ghost Gear',
  mine_cylinder: 'Mine / Cylinder',
  debris_anomaly: 'Debris Anomaly',
};

const CLASS_COLORS_MAP: Record<string, string> = {
  crab_pot: '#2dd4bf',
  ghost_gear: '#fbbf24',
  mine_cylinder: '#f87171',
  debris_anomaly: '#a78bfa',
};

function ShadowBadge({ evidence }: { evidence: Detection['shadow_evidence'] }) {
  if (evidence === 'SUPPORTING') {
    return <span className="badge badge-cyan" style={{ gap: 5 }}><ShieldCheck size={10} /> SUPPORTING</span>;
  }
  if (evidence === 'NEUTRAL') {
    return <span className="badge badge-amber" style={{ gap: 5 }}><Minus size={10} /> NEUTRAL</span>;
  }
  return (
    <span className="badge" style={{ background: 'rgba(61,90,122,0.2)', color: '#3d5a7a', border: '1px solid #112847', gap: 5 }}>
      <ShieldOff size={10} /> ABSENT
    </span>
  );
}

function DimRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{value}</span>
    </div>
  );
}

export function TargetDrawer() {
  const { state, dispatch } = useAppContext();
  const detection = state.result?.detections.find((d) => d.id === state.selectedDetectionId);

  const isOpen = !!detection;

  const close = () => dispatch({ type: 'SELECT_DETECTION', payload: null });

  const riskColor = detection ? RISK_COLORS[detection.hazard_risk] : '#64748b';
  const confColor = detection ? '#0f172a' : '#64748b';
  const classColor = detection ? (CLASS_COLORS_MAP[detection.target_class] ?? '#0f172a') : '#64748b';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        left: isOpen ? 0 : '100%',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.08)',
        transition: 'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      role="dialog"
      aria-label="Target Inspector"
      aria-hidden={!isOpen}
    >
      {detection && (
        <>
          {/* Drawer header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ flex: 1, fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>TARGET INSPECTOR</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.68rem', color: '#94a3b8' }}>{detection.id}</span>
            <button
              onClick={close}
              aria-label="Close inspector"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, display: 'flex' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* Thumbnail */}
            {detection.thumbnail_base64 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ marginBottom: 6, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ACOUSTIC THUMBNAIL</div>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <img
                    src={detection.thumbnail_base64}
                    alt="acoustic thumbnail"
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              </div>
            )}


            {/* Target class */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CLASSIFICATION</div>
              <span
                className="badge"
                style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px' }}
              >
                {CLASS_LABELS[detection.target_class] ?? detection.target_class}
              </span>
            </div>

            {/* Confidence */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>DETECTION CONFIDENCE</div>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  {formatConfidence(detection.confidence)}
                </span>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${detection.confidence * 100}%`,
                    height: '100%',
                    background: '#0f172a',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>

            {/* Shadow evidence */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ACOUSTIC SHADOW EVIDENCE</div>
              <ShadowBadge evidence={detection.shadow_evidence} />
            </div>

            {/* Dimensions */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Ruler size={11} /> PHYSICAL DIMENSIONS
              </div>
              <div style={{ padding: '0 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <DimRow label="Length" value={formatDimension(detection.dimensions.length_m)} />
                <DimRow label="Width" value={formatDimension(detection.dimensions.width_m)} />
                <DimRow label="Area" value={formatArea(detection.dimensions.area_m2)} />
                <DimRow label="Relief Height" value={formatDimension(detection.dimensions.relief_height_m)} />
              </div>
            </div>

            {/* Geolocation */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={11} /> GEOLOCATION
              </div>
              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {detection.geolocation ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                      {formatCoord(detection.geolocation.lat, true)}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                      {formatCoord(detection.geolocation.lon, false)}
                    </span>
                  </div>
                ) : detection.local_offset ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#64748b' }}>Local Offset</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                      X = {detection.local_offset.x_m >= 0 ? '+' : ''}{detection.local_offset.x_m.toFixed(1)} m
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                      Y = {detection.local_offset.y_m >= 0 ? '+' : ''}{detection.local_offset.y_m.toFixed(1)} m
                    </span>
                  </div>
                ) : (
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#94a3b8' }}>No coordinates available</span>
                )}
              </div>
            </div>

            {/* Hazard risk */}
            <div>
              <div style={{ marginBottom: 6, fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>HAZARD RISK PRIORITY</div>
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: `${riskColor}18`,
                  border: `1.5px solid ${riskColor}55`,
                  textAlign: 'center',
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: riskColor,
                  letterSpacing: '0.08em',
                }}
              >
                {detection.hazard_risk}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
