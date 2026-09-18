// src/components/layout/RightPanel.tsx
import React from 'react';
import { Maximize2, Minimize2, Crosshair, Database } from 'lucide-react';
import { KpiStrip } from '../dashboard/KpiStrip';
import { TargetList } from '../inspector/TargetList';
import { FrameDrawer } from '../inspector/FrameDrawer';
import { TargetDrawer } from '../inspector/TargetDrawer';
import { ClusterDrawer } from '../inspector/ClusterDrawer';
import { ExportPanel } from '../export/ExportPanel';
import { useAppContext } from '../../store/AppContext';

interface Props {
  width: number;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isDragging?: boolean;
}

export function RightPanel({ width, isMaximized = false, onToggleMaximize, isDragging = false }: Props) {
  const { state, dispatch } = useAppContext();
  const hasResults = !!state.result;

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: '#F7F8F4',
        borderLeft: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: isDragging ? 'none' : 'width 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '12px 16px 11px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#F7F8F4',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f172a',
          }}
        >
          <Crosshair size={13} />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            Mission Results
          </div>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
            Live Telemetry & Acoustic Targets
          </div>
        </div>

        {hasResults && (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#0f172a',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {state.result!.detections.length} Targets
          </span>
        )}

        {/* Maximize / Restore button */}
        {onToggleMaximize && (
          <button
            onClick={onToggleMaximize}
            title={isMaximized ? "Restore Mission Results width" : "Maximize Mission Results across screen"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 6,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#0f172a';
              (e.currentTarget as HTMLElement).style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#f8fafc';
              (e.currentTarget as HTMLElement).style.color = '#64748b';
            }}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
        <KpiStrip panelWidth={width} />
      </div>

      {/* Detections label */}
      <div style={{ padding: '14px 16px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Target Classification
          </span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>
      </div>

      {/* Target list */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TargetList />
      </div>

      {/* Export panel */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <ExportPanel />
      </div>

      {/* Slide-in inspector drawers */}
      {state.selectedDetectionId && <TargetDrawer />}
      {state.selectedFrame && !state.selectedDetectionId && (
        <FrameDrawer
          frame={state.selectedFrame}
          onClose={() => dispatch({ type: 'SELECT_FRAME', payload: null })}
          onSelectDetection={(detId) => dispatch({ type: 'SELECT_DETECTION', payload: detId })}
        />
      )}
      {state.selectedCluster && !state.selectedDetectionId && !state.selectedFrame && <ClusterDrawer />}
    </aside>
  );
}
