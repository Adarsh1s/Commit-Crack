// src/components/inspector/TargetCard.tsx
import React from 'react';
import type { Detection } from '../../types/sonar';
import { RISK_COLORS, CLASS_COLORS, confidenceToColor } from '../../utils/colorScale';
import { formatConfidence } from '../../utils/formatters';
import { useAppContext } from '../../store/AppContext';

const CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  ghost_gear: 'Ghost Gear',
  mine_cylinder: 'Underwater_pipeline',
  debris_anomaly: 'Debris Anomaly',
};

const CLASS_BADGE: Record<string, string> = {
  crab_pot: 'badge-teal',
  ghost_gear: 'badge-amber',
  mine_cylinder: 'badge-high',
  debris_anomaly: 'badge-purple',
};

interface Props {
  detection: Detection;
  isSelected: boolean;
}

export function TargetCard({ detection: det, isSelected }: Props) {
  const { dispatch } = useAppContext();
  const riskColor = RISK_COLORS[det.hazard_risk];
  const confColor = confidenceToColor(det.confidence);
  const confPct = det.confidence * 100;

  const handleClick = () => {
    dispatch({ type: 'SELECT_DETECTION', payload: isSelected ? null : det.id });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-pressed={isSelected}
      style={{
        padding: '11px 13px',
        borderRadius: 10,
        border: `1px solid ${isSelected ? '#0f172a' : '#e2e8f0'}`,
        background: isSelected ? '#f8fafc' : '#ffffff',
        cursor: 'pointer',
        transition: 'all 180ms ease',
        boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Top row: class + risk */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className={`badge ${CLASS_BADGE[det.target_class]}`}>
          {CLASS_LABELS[det.target_class] ?? det.target_class}
        </span>
        <span
          className="badge"
          style={{ background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}44`, fontSize: '0.5625rem' }}
        >
          {det.hazard_risk}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: `${confPct}%`,
              height: '100%',
              background: '#0f172a',
              borderRadius: 2,
              transition: 'width 300ms ease',
            }}
          />
        </div>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6875rem', fontWeight: 600, color: '#0f172a', minWidth: 36, textAlign: 'right' }}>
          {formatConfidence(det.confidence)}
        </span>
      </div>

      {/* Shadow evidence */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: '0.6rem', color: '#94a3b8', letterSpacing: '0.04em', fontWeight: 600 }}>SHADOW</span>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: det.shadow_evidence === 'SUPPORTING' ? '#0f172a' : det.shadow_evidence === 'NEUTRAL' ? '#64748b' : '#94a3b8',
          }}
        >
          {det.shadow_evidence}
        </span>
      </div>
    </div>
  );
}
