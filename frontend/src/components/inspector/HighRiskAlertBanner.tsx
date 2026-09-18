// src/components/inspector/HighRiskAlertBanner.tsx
import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import type { Detection } from '../../types/sonar';
import { shouldShowHighRiskAlert, isVerificationEligible, getTargetClassLabel } from '../../utils/expertVerification';
import { RISK_COLORS } from '../../utils/colorScale';
import { useAppContext } from '../../store/AppContext';

interface Props {
  detection: Detection;
  onOpenInspector?: () => void;
  compact?: boolean;
}

export function HighRiskAlertBanner({ detection: det, onOpenInspector, compact = false }: Props) {
  const { dispatch } = useAppContext();
  const isHighRiskAlert = shouldShowHighRiskAlert(det.hazard_risk, det.confidence);
  const isEligible = isVerificationEligible(det.hazard_risk, det.confidence);

  if (!isHighRiskAlert && !isEligible && !det.expert_verified) {
    return null;
  }

  const confPct = Math.round(det.confidence * 100);
  const classLabel = getTargetClassLabel(det.target_class);
  const riskColor = RISK_COLORS[det.hazard_risk];

  // Already Verified state
  if (det.expert_verified) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '6px 10px' : '8px 12px',
          borderRadius: 8,
          background: '#f0fdf4',
          border: '1px solid #86efac',
          color: '#15803d',
          fontSize: compact ? '0.7rem' : '0.75rem',
          fontWeight: 600,
        }}
      >
        <CheckCircle2 size={14} color="#16a34a" />
        <span style={{ flex: 1 }}>Expert Verified Target</span>
        <span
          style={{
            fontSize: '0.62rem',
            background: '#dcfce7',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
          }}
        >
          CONFIRMED
        </span>
      </div>
    );
  }

  // Requirement 2: High or Critical AND confidence > 75%
  // Clearly visible high-risk alert with danger level, detected object/class, and AI confidence
  if (isHighRiskAlert) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: compact ? '8px 10px' : '10px 14px',
          borderRadius: 8,
          background: det.hazard_risk === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
          border: `1.5px solid ${det.hazard_risk === 'CRITICAL' ? '#f87171' : '#fcd34d'}`,
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={15} color={riskColor} />
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: riskColor,
              textTransform: 'uppercase',
            }}
          >
            HIGH-RISK TARGET ALERT
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: 4,
              background: `${riskColor}22`,
              color: riskColor,
              border: `1px solid ${riskColor}55`,
            }}
          >
            {det.hazard_risk}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#1e293b', lineHeight: 1.35 }}>
          Danger Level: <strong>{det.hazard_risk}</strong> · Object: <strong>{classLabel}</strong> · AI Confidence:{' '}
          <strong style={{ fontFamily: 'JetBrains Mono' }}>{confPct}%</strong>
        </div>

        {onOpenInspector && (
          <button
            onClick={onOpenInspector}
            style={{
              alignSelf: 'flex-start',
              marginTop: 2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.68rem',
              fontWeight: 700,
              color: riskColor,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span>Inspect Target</span>
            <ArrowRight size={11} />
          </button>
        )}
      </div>
    );
  }

  // Requirement 3: High or Critical AND 35% < confidence < 75%
  // Optional Expert Verification notice
  if (isEligible) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: compact ? '8px 10px' : '10px 14px',
          borderRadius: 8,
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#d97706" />
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: '#0f172a',
              textTransform: 'uppercase',
            }}
          >
            OPTIONAL EXPERT VERIFICATION AVAILABLE
          </span>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.35 }}>
          The AI has detected a potentially high-risk target (<strong>{classLabel}</strong>, {det.hazard_risk}) with lower confidence (<strong>{confPct}%</strong>). Expert verification is available.
        </div>

        {det.expert_status === 'SKIPPED' ? (
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontStyle: 'italic' }}>
            Verification skipped · Target remains fully active
          </div>
        ) : onOpenInspector ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onOpenInspector}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 6,
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.74rem',
                fontWeight: 700,
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
            >
              <span>Verify Target</span>
              <ArrowRight size={13} />
            </button>
            <button
              onClick={() => dispatch({ type: 'SKIP_EXPERT_VERIFICATION', payload: { detectionId: det.id } })}
              style={{
                padding: '7px 12px',
                borderRadius: 6,
                background: '#f1f5f9',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            >
              Skip
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
