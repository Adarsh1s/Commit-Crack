// src/components/inspector/ClusterDrawer.tsx
import React from 'react';
import {
  X,
  Layers,
  ZoomIn,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { DENSITY_CONFIG } from '../../utils/spatialClustering';
import { RISK_COLORS } from '../../utils/colorScale';
import { formatCoord, formatConfidence } from '../../utils/formatters';
import { TARGET_CLASS_LABELS } from '../../utils/expertVerification';

interface Props {
  onZoomIntoCluster?: () => void;
}

export function ClusterDrawer({ onZoomIntoCluster }: Props) {
  const { state, dispatch } = useAppContext();
  const cluster = state.selectedCluster;

  if (!cluster) return null;

  const density = DENSITY_CONFIG[cluster.densityTier];
  const riskColor = RISK_COLORS[cluster.highestRisk];

  const close = () => dispatch({ type: 'SELECT_CLUSTER', payload: null });

  // Compute approximate diameter/spread in km (1 deg ~ 111 km)
  const latSpreadKm = (cluster.bounds.maxLat - cluster.bounds.minLat) * 111;
  const lonSpreadKm = (cluster.bounds.maxLon - cluster.bounds.minLon) * 111 * Math.cos((cluster.center.lat * Math.PI) / 180);
  const spreadKm = Math.sqrt(latSpreadKm * latSpreadKm + lonSpreadKm * lonSpreadKm);

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
      aria-label="Cluster Inspector"
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
            width: 26,
            height: 26,
            borderRadius: 6,
            background: density.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          <Layers size={14} />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            SURVEY CLUSTER
          </div>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
            {cluster.frameCount ?? cluster.count} Survey Frames · {cluster.totalAnomalyCount ?? cluster.detections.length} Anomalies
          </div>
        </div>

        {onZoomIntoCluster && (
          <button
            onClick={onZoomIntoCluster}
            title="Zoom into this cluster"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            <ZoomIn size={12} />
            <span>Expand</span>
          </button>
        )}

        <button
          onClick={close}
          aria-label="Close cluster inspector"
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Density & Concentration Banner */}
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: `${density.color}14`,
            border: `1.5px solid ${density.color}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} color={density.color} />
            <div>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  color: density.color,
                  textTransform: 'uppercase',
                }}
              >
                SPATIAL CONCENTRATION
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                {density.label}
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
              color: density.color,
            }}
          >
            {cluster.count} pts
          </span>
        </div>

        {/* Geographic Centroid & Area */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              marginBottom: 6,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <MapPin size={11} /> GEOGRAPHIC REGION & CENTROID
          </div>
          <div
            style={{
              padding: '10px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Centroid</span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {formatCoord(cluster.center.lat, true)} · {formatCoord(cluster.center.lon, false)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Cluster Spread</span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {spreadKm < 0.1 ? '< 100 m' : `~${spreadKm.toFixed(1)} km span`}
              </span>
            </div>
          </div>
        </div>

        {/* Hazard Risk Summary */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              marginBottom: 6,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldAlert size={11} /> HAZARD RISK COMPOSITION
            </span>
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                color: riskColor,
                padding: '1px 6px',
                borderRadius: 4,
                background: `${riskColor}18`,
                border: `1px solid ${riskColor}44`,
              }}
            >
              HIGHEST: {cluster.highestRisk}
            </span>
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => {
              const cnt = cluster.riskCounts[r] || 0;
              const pct = Math.round((cnt / cluster.count) * 100);
              const color = RISK_COLORS[r];
              return (
                <div key={r}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ color }}>{r}</span>
                    <span style={{ color: '#0f172a', fontFamily: 'JetBrains Mono' }}>
                      {cnt} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: '#e2e8f0',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expert Verification Count */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              padding: '8px 12px',
              background: cluster.expertVerifiedCount > 0 ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${cluster.expertVerifiedCount > 0 ? '#86efac' : '#e2e8f0'}`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck
                size={14}
                color={cluster.expertVerifiedCount > 0 ? '#15803d' : '#94a3b8'}
              />
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: cluster.expertVerifiedCount > 0 ? '#15803d' : '#64748b',
                }}
              >
                Expert Verified Targets
              </span>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
                color: cluster.expertVerifiedCount > 0 ? '#15803d' : '#64748b',
              }}
            >
              {cluster.expertVerifiedCount} / {cluster.count}
            </span>
          </div>
        </div>

        {/* Target Class Breakdown */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              marginBottom: 6,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            TARGET CLASSIFICATIONS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(cluster.classCounts).map(([cls, cnt]) => (
              <span
                key={cls}
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{TARGET_CLASS_LABELS[cls] ?? cls}</span>
                <strong style={{ fontFamily: 'JetBrains Mono', color: '#0284c7' }}>{cnt}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Target List Preview */}
        <div>
          <div
            style={{
              marginBottom: 8,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>CONTAINED TARGETS ({cluster.detections.length})</span>
            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Click to inspect</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cluster.detections.map((det) => {
              const rColor = RISK_COLORS[det.hazard_risk];
              return (
                <div
                  key={det.id}
                  onClick={() => dispatch({ type: 'SELECT_DETECTION', payload: det.id })}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 150ms ease',
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
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                        {TARGET_CLASS_LABELS[det.target_class] ?? det.target_class}
                      </span>
                      <span
                        style={{
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: `${rColor}18`,
                          color: rColor,
                          border: `1px solid ${rColor}44`,
                        }}
                      >
                        {det.hazard_risk}
                      </span>
                      {det.expert_verified && (
                        <span
                          style={{
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                          }}
                        >
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>
                      ID: {det.id} · AI Conf: {formatConfidence(det.confidence)}
                    </div>
                  </div>

                  <ArrowRight size={14} color="#94a3b8" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
