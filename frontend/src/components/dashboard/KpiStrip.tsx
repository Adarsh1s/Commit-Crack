// src/components/dashboard/KpiStrip.tsx
import React from 'react';
import { BarChart2, Crosshair, Box, AlertTriangle } from 'lucide-react';
import { KpiCard } from './KpiCard';
import { useAppContext } from '../../store/AppContext';

interface Props {
  panelWidth?: number;
}

export function KpiStrip({ panelWidth = 360 }: Props) {
  const { state } = useAppContext();
  const kpis = state.result?.kpis ?? {
    total_surveys: 0,
    total_detections: 0,
    verified_3d_objects: 0,
    critical_hazards: 0,
  };

  // If panel is narrow (< 520px), use 2x2 grid so tiles never squish or overflow
  // If panel is wide (>= 520px), use 4 columns in 1 row
  const isWide = panelWidth >= 520;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isWide ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
        gap: 8,
        width: '100%',
      }}
    >
      <KpiCard
        label="SURVEYS"
        value={kpis.total_surveys}
        icon={BarChart2}
        accentColor="#0ea5c8"
      />
      <KpiCard
        label="DETECTIONS"
        value={kpis.total_detections}
        icon={Crosshair}
        accentColor="#38bdf8"
      />
      <KpiCard
        label="3D OBJECTS"
        value={kpis.verified_3d_objects}
        icon={Box}
        accentColor="#34d399"
      />
      <KpiCard
        label="CRITICAL"
        value={kpis.critical_hazards}
        icon={AlertTriangle}
        accentColor="#f87171"
        glowOnNonZero
      />
    </div>
  );
}
