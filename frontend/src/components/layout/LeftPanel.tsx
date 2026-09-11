// src/components/layout/LeftPanel.tsx
import React from 'react';
import { Maximize2, Minimize2, Sliders, Shield } from 'lucide-react';
import { SonarDropzone } from '../upload/SonarDropzone';
import { NavCsvUploader } from '../upload/NavCsvUploader';
import { ProcessingPanel } from '../controls/ProcessingPanel';
import { RunButton } from '../controls/RunButton';

interface Props {
  width: number;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isDragging?: boolean;
}

export function LeftPanel({ width, isMaximized = false, onToggleMaximize, isDragging = false }: Props) {
  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: '#F7F8F4',
        borderRight: '1px solid #e2e8f0',
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
          padding: '14px 18px 13px',
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
            width: 26,
            height: 26,
            borderRadius: 8,
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f172a',
          }}
        >
          <Sliders size={14} />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '0.90rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Mission Controls
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
            Telemetry Ingestion & DSP
          </div>
        </div>

        {/* Maximize / Restore button */}
        {onToggleMaximize && (
          <button
            onClick={onToggleMaximize}
            title={isMaximized ? "Restore Mission Controls width" : "Maximize Mission Controls across screen"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
              (e.currentTarget as HTMLElement).style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#f8fafc';
              (e.currentTarget as HTMLElement).style.color = '#475569';
            }}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background: '#ffffff',
        }}
      >
        <SonarDropzone />
        <NavCsvUploader />
        <Divider label="DSP & Inference Pipeline" />
        <ProcessingPanel />
        <Divider label="Execution Dispatch" />
        <RunButton />
      </div>
    </aside>
  );
}

function Divider({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
      {label && (
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#64748b',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  );
}
