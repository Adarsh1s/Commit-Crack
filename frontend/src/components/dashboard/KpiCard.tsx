// src/components/dashboard/KpiCard.tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accentColor: string;
  glowOnNonZero?: boolean;
}

export function KpiCard({ label, value, icon: Icon, accentColor, glowOnNonZero }: KpiCardProps) {
  const hasGlow = glowOnNonZero && value > 0;

  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${hasGlow ? accentColor : '#e2e8f0'}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 0,
        transition: 'all 200ms ease',
        boxShadow: hasGlow ? `0 2px 10px ${accentColor}25` : '0 1px 3px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header: Label + Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: hasGlow ? `${accentColor}15` : '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${hasGlow ? accentColor + '33' : '#e2e8f0'}`,
            flexShrink: 0,
          }}
        >
          <Icon size={12} color={hasGlow ? accentColor : '#0f172a'} />
        </div>
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: hasGlow ? accentColor : '#0f172a',
          lineHeight: 1.1,
          transition: 'color 200ms ease',
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
