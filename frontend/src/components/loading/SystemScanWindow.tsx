// src/components/loading/SystemScanWindow.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Monitor } from 'lucide-react';
import type { SystemInfo } from '../../types/sonar';

interface Props {
  systemInfo: SystemInfo;
  onComplete: () => void;
}

interface ScanLine {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'pending';
}

function buildScanLines(info: SystemInfo): ScanLine[] {
  const ramDisplay = info.ramTotalGb != null
    ? `${info.ramTotalGb} GB Total${info.ramAvailableGb != null ? ` (${info.ramAvailableGb} GB free)` : ''}`
    : info.deviceMemoryGb != null
    ? `${info.deviceMemoryGb} GB RAM`
    : 'Not reported by browser';

  const cpuDisplay = info.cpuName
    ? `${info.cpuName} (${info.cpuCores} threads${info.physicalCores ? `, ${info.physicalCores} cores` : ''})`
    : `${info.cpuCores} logical processors`;

  const gpuDisplay = info.gpuName
    ? `${info.gpuName}${info.vramGb ? ` (${info.vramGb} GB VRAM)` : ''}`
    : info.gpuRenderer;

  return [
    { label: 'RUNTIME', value: info.userAgent.slice(0, 60) + '...', status: 'ok' },
    { label: 'CPU ARCHITECTURE', value: cpuDisplay, status: info.cpuCores >= 4 ? 'ok' : 'warn' },
    { label: 'SYSTEM MEMORY', value: ramDisplay, status: (info.ramTotalGb ?? info.deviceMemoryGb ?? 4) >= 4 ? 'ok' : 'warn' },
    { label: 'PRIMARY GPU', value: gpuDisplay, status: info.webgl ? 'ok' : 'warn' },
    { label: 'WEBGL SUPPORT', value: info.webgl ? 'Hardware accelerated — available' : 'Not available', status: info.webgl ? 'ok' : 'warn' },
    { label: 'CANVAS 2D', value: info.canvas2d ? 'Supported' : 'Not supported', status: info.canvas2d ? 'ok' : 'warn' },
    { label: 'SHARED ARRAY BUFFER', value: info.sharedArrayBuffer ? 'Enabled — multi-thread ready' : 'Disabled — single-thread mode', status: info.sharedArrayBuffer ? 'ok' : 'warn' },
    { label: 'DISPLAY', value: `${info.screenWidth} × ${info.screenHeight} px`, status: 'ok' },
  ];
}

export function SystemScanWindow({ systemInfo, onComplete }: Props) {
  const lines = buildScanLines(systemInfo);
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), 200 + i * 280));
    });
    timers.push(setTimeout(() => setDone(true), 200 + lines.length * 280 + 400));
    timers.push(setTimeout(onComplete, 200 + lines.length * 280 + 900));
    return () => timers.forEach(clearTimeout);
  }, [onComplete, lines.length]);

  return (
    <div className="loading-screen">
      <div className="scanline-overlay" />
      <div className="phosphor-grid" />

      {/* Corner decorations */}
      <div style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderTop: '2px solid rgba(14,165,200,0.4)', borderLeft: '2px solid rgba(14,165,200,0.4)' }} />
      <div style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderTop: '2px solid rgba(14,165,200,0.4)', borderRight: '2px solid rgba(14,165,200,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderBottom: '2px solid rgba(14,165,200,0.4)', borderLeft: '2px solid rgba(14,165,200,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderBottom: '2px solid rgba(14,165,200,0.4)', borderRight: '2px solid rgba(14,165,200,0.4)' }} />

      <div
        className="terminal-window relative z-10"
        style={{
          width: '100%',
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            background: '#080f1a',
            border: '1px solid #1a3a5c',
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Monitor size={14} color="#0ea5c8" />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#7a9abf', letterSpacing: '0.08em' }}>
            SYSTEM CAPABILITY ANALYSIS
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['#f87171', '#fbbf24', '#34d399'].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
            ))}
          </div>
        </div>

        {/* Terminal body */}
        <div
          style={{
            background: 'rgba(8, 15, 26, 0.95)',
            border: '1px solid #1a3a5c',
            borderRadius: '0 0 8px 8px',
            padding: '20px 20px',
            minHeight: 340,
            backdropFilter: 'blur(8px)',
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 10,
                opacity: i < visibleCount ? 1 : 0,
                transform: i < visibleCount ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.25s ease, transform 0.25s ease',
              }}
            >
              {/* Status icon */}
              <div style={{ width: 16, flexShrink: 0, paddingTop: 1 }}>
                {i < visibleCount ? (
                  line.status === 'ok'
                    ? <CheckCircle size={14} color="#34d399" />
                    : <AlertTriangle size={14} color="#fbbf24" />
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #3d5a7a' }} />
                )}
              </div>

              {/* Label */}
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6875rem', color: '#3d5a7a', letterSpacing: '0.08em', width: 180, flexShrink: 0, paddingTop: 1 }}>
                {line.label}
              </span>

              {/* Value */}
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: line.status === 'warn' ? '#fbbf24' : '#e2eaf4', flex: 1, wordBreak: 'break-all' }}>
                {line.value}
              </span>
            </div>
          ))}

          {/* Cursor at end */}
          {!done && visibleCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#3d5a7a' }}>$</span>
              <span className="cursor" />
            </div>
          )}

          {done && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                animation: 'fadeIn 0.4s ease',
              }}
            >
              <CheckCircle size={16} color="#34d399" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#34d399', letterSpacing: '0.05em' }}>
                HARDWARE PROFILE COMPLETE — SELECTING COMPUTE TIER
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
