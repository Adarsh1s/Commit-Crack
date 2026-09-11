// src/components/inspector/TargetList.tsx
import React from 'react';
import { Crosshair } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { TargetCard } from './TargetCard';

export function TargetList() {
  const { state } = useAppContext();
  const detections = state.result?.detections ?? [];

  if (detections.length === 0) {
    let mainMsg = 'No detections yet';
    let subMsg = 'Load a sonar image and click Analyze Sonar';

    if (state.status === 'complete') {
      mainMsg = 'No targets detected';
      subMsg = 'Try lowering confidence threshold or toggling CLAHE / Slant-Range filters';
    } else if (state.status === 'uploading' || state.status === 'processing') {
      mainMsg = 'Processing acoustic pipeline...';
      subMsg = 'Running YOLOv8 + Acoustic Shadow verification';
    } else if (state.status === 'error') {
      mainMsg = 'Analysis failed';
      subMsg = state.error || 'Check server connection and retry';
    }

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Crosshair size={20} color="#94a3b8" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
            {mainMsg}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, maxWidth: 220, lineHeight: 1.3 }}>
            {subMsg}
          </div>
        </div>
      </div>
    );
  }

  // Sort: CRITICAL first, then HIGH, MEDIUM, LOW
  const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...detections].sort((a, b) => riskOrder[a.hazard_risk] - riskOrder[b.hazard_risk]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((det) => (
        <TargetCard
          key={det.id}
          detection={det}
          isSelected={state.selectedDetectionId === det.id}
        />
      ))}
    </div>
  );
}
