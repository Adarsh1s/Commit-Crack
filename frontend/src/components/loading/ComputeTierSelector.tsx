// src/components/loading/ComputeTierSelector.tsx
import React, { useEffect, useState } from 'react';
import { MapPin, Loader2, CheckCircle, XCircle, Cpu, Zap, Battery } from 'lucide-react';
import type { ComputeTier, GeoCoordinate } from '../../types/sonar';
import { TIER_LABELS } from '../../utils/computeTier';
import { formatCoord } from '../../utils/formatters';

interface Props {
  autoTier: ComputeTier;
  onConfirm: (tier: ComputeTier, location: GeoCoordinate | null) => void;
}

const TIER_ICONS = { A: Zap, B: Cpu, C: Battery };

type LocationState =
  | { phase: 'fetching' }
  | { phase: 'granted'; location: GeoCoordinate }
  | { phase: 'denied'; message: string };

export function ComputeTierSelector({ autoTier, onConfirm }: Props) {
  const [selectedTier, setSelectedTier] = useState<ComputeTier>(autoTier);
  const [locationState, setLocationState] = useState<LocationState>({ phase: 'fetching' });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Fetch location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState({ phase: 'denied', message: 'Geolocation not supported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationState({
          phase: 'granted',
          location: { lat: pos.coords.latitude, lon: pos.coords.longitude },
        });
      },
      (err) => {
        const msg: Record<number, string> = {
          1: 'Location access denied',
          2: 'No GPS signal available',
          3: 'Location request timed out',
        };
        setLocationState({ phase: 'denied', message: msg[err.code] ?? 'Location unavailable' });
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const handleConfirm = () => {
    const loc = locationState.phase === 'granted' ? locationState.location : null;
    onConfirm(selectedTier, loc);
  };

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
        style={{
          width: '100%',
          maxWidth: 680,
          padding: '0 24px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 8 }}>ADAPTIVE COMPUTE CONFIGURATION</span>
          <h2 style={{ fontFamily: 'Inter', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#e2eaf4', margin: 0 }}>
            Select Processing Tier
          </h2>
          <p style={{ color: '#7a9abf', fontSize: '0.8125rem', marginTop: 6 }}>
            Auto-selected based on hardware profile. Override if needed.
          </p>
        </div>

        {/* Tier pills */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
          {(['A', 'B', 'C'] as ComputeTier[]).map((tier) => {
            const info = TIER_LABELS[tier];
            const Icon = TIER_ICONS[tier];
            const isSelected = selectedTier === tier;
            const isAuto = tier === autoTier;
            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                style={{
                  flex: 1,
                  padding: '16px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${isSelected ? info.color : '#1a3a5c'}`,
                  background: isSelected ? `${info.color}18` : '#0d1929',
                  color: isSelected ? info.color : '#7a9abf',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  boxShadow: isSelected ? `0 0 16px ${info.color}44` : 'none',
                  textAlign: 'center',
                  position: 'relative',
                }}
              >
                {isAuto && (
                  <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: info.color, color: '#050c14', fontSize: '0.5625rem', fontWeight: 700, padding: '1px 6px', borderRadius: 9999, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    AUTO-SELECTED
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <Icon size={22} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {tier}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>{info.label}</div>
                <div style={{ fontSize: '0.6875rem', color: isSelected ? `${info.color}cc` : '#3d5a7a', lineHeight: 1.4 }}>
                  {info.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Location block */}
        <div
          style={{
            background: '#080f1a',
            border: '1px solid #1a3a5c',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <MapPin size={18} color="#0ea5c8" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="text-label" style={{ marginBottom: 4 }}>VESSEL LOCATION</div>
            {locationState.phase === 'fetching' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={13} color="#0ea5c8" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#7a9abf' }}>
                  Acquiring GPS fix...
                </span>
              </div>
            )}
            {locationState.phase === 'granted' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CheckCircle size={13} color="#34d399" />
                <span className="badge badge-green" style={{ fontSize: '0.625rem' }}>GPS LOCK</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem', color: '#e2eaf4' }}>
                  {formatCoord(locationState.location.lat, true)} &nbsp; {formatCoord(locationState.location.lon, false)}
                </span>
              </div>
            )}
            {locationState.phase === 'denied' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle size={13} color="#f87171" />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#f87171' }}>
                  {locationState.message} — using manual coordinates
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          className="btn-primary"
          style={{ width: '100%', fontSize: '0.9375rem', padding: '13px 24px', letterSpacing: '0.06em' }}
        >
          INITIALIZE MISSION
        </button>

        <p style={{ textAlign: 'center', color: '#3d5a7a', fontSize: '0.6875rem', marginTop: 14, fontFamily: 'JetBrains Mono', letterSpacing: '0.05em' }}>
          SONAR·OS v1.0.0 · Air-gapped mission system
        </p>
      </div>
    </div>
  );
}
