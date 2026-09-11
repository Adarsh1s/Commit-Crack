// src/components/controls/ProcessingPanel.tsx
import React from 'react';
import { Info } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { confidenceToColor } from '../../utils/colorScale';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}

function ToggleRow({ label, description, checked, onChange, id }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        padding: '10px 0',
        borderBottom: '1px solid #f1f5f9',
        userSelect: 'none',
      }}
    >
      <div
        id={id}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        className={`toggle-track ${checked ? 'active' : ''}`}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange(!checked)}
        aria-label={label}
      >
        <div className="toggle-knob" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', transition: 'color 200ms' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>{description}</div>
      </div>
    </label>
  );
}

export function ProcessingPanel() {
  const { state, dispatch } = useAppContext();
  const { params } = state;

  const setParam = (key: keyof typeof params, value: boolean | number) => {
    dispatch({ type: 'SET_PARAMS', payload: { [key]: value } });
  };

  const pct = ((params.confidence_threshold - 0.05) / 0.9) * 100;

  return (
    <div>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Processing Parameters
      </div>

      <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '4px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <ToggleRow
          id="toggle-slant"
          label="Slant-Range Correction"
          description="Compensates for geometric distortion"
          checked={params.slant_range_correction}
          onChange={(v) => setParam('slant_range_correction', v)}
        />
        <ToggleRow
          id="toggle-clahe"
          label="CLAHE Equalization"
          description="Adaptive contrast enhancement"
          checked={params.clahe_equalization}
          onChange={(v) => setParam('clahe_equalization', v)}
        />
        <ToggleRow
          id="toggle-nadir"
          label="Nadir Excision"
          description="Remove nadir zone blind spot"
          checked={params.nadir_excision}
          onChange={(v) => setParam('nadir_excision', v)}
        />
      </div>

      {/* Confidence slider (Matching Reference Photo) */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Confidence Threshold
            </span>
            <span title="Minimum detection confidence. Higher = fewer but more certain results." style={{ cursor: 'pointer' }}>
              <Info size={13} color="#64748b" />
            </span>
          </div>
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 800,
              color: '#0f172a',
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {params.confidence_threshold.toFixed(2)}
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            type="range"
            id="confidence-slider"
            min={0.05}
            max={0.95}
            step={0.01}
            value={params.confidence_threshold}
            onChange={(e) => setParam('confidence_threshold', parseFloat(e.target.value))}
            aria-label="Confidence threshold"
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: `linear-gradient(to right, #0f172a 0%, #0f172a ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>0.05 · More detections</span>
          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>0.95 · High certainty</span>
        </div>
      </div>
    </div>
  );
}
