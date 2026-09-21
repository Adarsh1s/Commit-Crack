// src/components/layout/TopBar.tsx
import React, { useEffect, useState } from 'react';
import { Activity, Clock, Zap, Cpu, Battery, Terminal } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { TIER_LABELS } from '../../utils/computeTier';
import type { ComputeTier } from '../../types/sonar';
import { CliCommandsModal } from './CliCommandsModal';
import { BackendSettingsModal } from './BackendSettingsModal';

const TIER_ICONS: Record<ComputeTier, React.FC<{ size: number; color: string }>> = {
  A: ({ size, color }) => <Zap size={size} color={color} />,
  B: ({ size, color }) => <Cpu size={size} color={color} />,
  C: ({ size, color }) => <Battery size={size} color={color} />,
};

export function TopBar() {
  const { state } = useAppContext();
  const [utcTime, setUtcTime] = useState('');
  const [showCliModal, setShowCliModal] = useState(false);
  const [showBackendModal, setShowBackendModal] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const tier = state.computeTier;
  const tierInfo = TIER_LABELS[tier];
  const TierIcon = TIER_ICONS[tier];

  const statusColors = {
    idle: 'transparent',
    uploading: '#38bdf8',
    processing: '#38bdf8',
    complete: '#34d399',
    error: '#f87171',
  };

  return (
    <header
      style={{
        height: 52,
        background: '#F7F8F4',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 14,
        flexShrink: 0,
        zIndex: 50,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Brand & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <img
          src="/logo.png"
          alt="Aqua Sentinel"
          style={{
            height: 38,
            width: 'auto',
            objectFit: 'contain',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: '0.66rem',
              color: '#64748b',
              fontWeight: 700,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: 12,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            v1.0 · Air-Gapped
          </span>
        </div>
      </div>

      <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

      {/* Backend Status Pill */}
      <div
        onClick={() => setShowBackendModal(true)}
        title="Click to view backend connection or configure remote API URL"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 11px',
          borderRadius: 20,
          background: state.backendOnline ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${state.backendOnline ? '#bbf7d0' : '#fecaca'}`,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: state.backendOnline ? '#16a34a' : '#dc2626',
          }}
        />
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: state.backendOnline ? '#15803d' : '#b91c1c',
            letterSpacing: '0.02em',
          }}
        >
          {state.backendOnline ? 'Backend Online' : 'Backend Standby'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Analysis Status Pill */}
      {state.status !== 'idle' && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            border: `1px solid ${statusColors[state.status]}40`,
            background: '#f8fafc',
            cursor: 'pointer',
          }}
        >
          {(state.status === 'uploading' || state.status === 'processing') && (
            <Activity size={12} color="#0284c7" style={{ animation: 'spin 1.5s linear infinite' }} />
          )}
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: statusColors[state.status],
              textTransform: 'uppercase',
            }}
          >
            {state.status}
          </span>
        </div>
      )}

      {/* Compute Tier Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          cursor: 'pointer',
        }}
      >
        <TierIcon size={12} color={tierInfo.color} />
        <span
          style={{
            fontSize: '0.70rem',
            color: '#0f172a',
            fontWeight: 700,
          }}
        >
          Tier {tier} · <span style={{ color: tierInfo.color }}>{tierInfo.label}</span>
        </span>
      </div>

      {/* UTC Clock Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          cursor: 'default',
        }}
      >
        <Clock size={12} color="#64748b" />
        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
          {utcTime}
        </span>
      </div>

      {/* CLI Terminal Commands Button */}
      <button
        onClick={() => setShowCliModal(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 16,
          background: '#0f172a',
          border: '1px solid #1e293b',
          cursor: 'pointer',
          color: '#38bdf8',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 150ms ease',
        }}
        title="View terminal commands to run missions from terminal"
      >
        <Terminal size={13} color="#38bdf8" />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em', color: '#f8fafc' }}>
          CLI Commands
        </span>
      </button>

      {/* CLI Commands Modal */}
      <CliCommandsModal isOpen={showCliModal} onClose={() => setShowCliModal(false)} />

      {/* Backend Settings Modal */}
      <BackendSettingsModal isOpen={showBackendModal} onClose={() => setShowBackendModal(false)} />
    </header>
  );
}
