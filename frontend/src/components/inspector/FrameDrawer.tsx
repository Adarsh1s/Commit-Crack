// src/components/inspector/FrameDrawer.tsx
import React from 'react';
import {
  X,
  FileImage,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Layers,
  Ruler,
  Eye,
} from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS, confidenceToColor } from '../../utils/colorScale';
import { formatCoord, formatConfidence, formatDimension } from '../../utils/formatters';
import { TARGET_CLASS_LABELS, isVerificationEligible } from '../../utils/expertVerification';
import type { SurveyFrame, Detection } from '../../types/sonar';

interface Props {
  frame: SurveyFrame;
  onClose: () => void;
  onSelectDetection: (detectionId: string) => void;
}

export function FrameDrawer({ frame, onClose, onSelectDetection }: Props) {
  const { dispatch } = useAppContext();
  const riskColor = RISK_COLORS[frame.highestRisk] ?? '#0284c7';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      role="dialog"
      aria-label="Survey Frame Inspector"
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#f8fafc',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          <FileImage size={15} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            SURVEY OBSERVATION
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={frame.filename}
          >
            {frame.filename}
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close frame inspector"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
            padding: 4,
            display: 'flex',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* Frame Image Preview */}
        {frame.thumbnail_url && (
          <div
            style={{
              width: '100%',
              height: 140,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#0a0f1a',
              marginBottom: 14,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={frame.thumbnail_url}
              alt={frame.filename}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Severity Banner */}
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 8,
            background: `${riskColor}12`,
            border: `1.5px solid ${riskColor}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={16} color={riskColor} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: riskColor, letterSpacing: '0.04em' }}>
              HIGHEST RISK: {frame.highestRisk}
            </span>
          </div>

          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
            }}
          >
            {frame.anomalyCount} Anomaly{frame.anomalyCount !== 1 ? 'ies' : ''}
          </span>
        </div>

        {/* Telemetry Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>GPS POSITION</div>
            <div style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 700, marginTop: 2 }}>
              {frame.geolocation ? `${formatCoord(frame.geolocation.lat, true)}, ${formatCoord(frame.geolocation.lon, false)}` : 'N/A'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700 }}>MAX AI CONFIDENCE</div>
            <div style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 800, marginTop: 2, fontFamily: 'JetBrains Mono' }}>
              {Math.round(frame.highestConfidence * 100)}%
            </div>
          </div>
        </div>

        {/* Detections in this frame */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            DETECTED TARGETS IN FRAME ({frame.detections.length})
          </div>
        </div>

        {frame.detections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>No active anomalies in this frame.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {frame.detections.map((det) => {
              const detRiskColor = RISK_COLORS[det.hazard_risk];
              const isEligible = isVerificationEligible(det.hazard_risk, det.confidence);

              return (
                <div
                  key={det.id}
                  onClick={() => onSelectDetection(det.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0f172a';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                      {TARGET_CLASS_LABELS[det.target_class] ?? det.target_class}
                    </span>
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: `${detRiskColor}18`,
                        color: detRiskColor,
                        border: `1px solid ${detRiskColor}44`,
                      }}
                    >
                      {det.hazard_risk}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.68rem', color: '#64748b' }}>
                    <span>Conf: <strong style={{ color: '#0f172a', fontFamily: 'JetBrains Mono' }}>{Math.round(det.confidence * 100)}%</strong></span>
                    <span>Length: <strong>{det.dimensions.length_m.toFixed(1)}m</strong></span>
                    <span>Height: <strong>{det.dimensions.relief_height_m.toFixed(1)}m</strong></span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: '#0284c7', fontWeight: 700, gap: 2 }}>
                      <span>Inspect</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>

                  {det.expert_verified && (
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                      <CheckCircle2 size={10} />
                      EXPERT VERIFIED
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
