// src/components/loading/LogoIntroScene.tsx
// Exact implementation of the technical diagram loading screen inspired by the reference schematic.
// Clean ivory canvas, fine dashed grid lines, top animated Aqua Sentinel logo,
// dashed feature nodes (Acoustic Telemetry, Side-Scan Bathymetry, Target Classification, 3D Mesh),
// center Neural Engine node, bottom Acoustic Sensor Matrix, and Hydrophone Frequency Spectrum graph.

import React, { useEffect, useRef, useState } from 'react';

interface Props {
  isFading: boolean;
  onFadeStart: () => void;
  onComplete: () => void;
}

export function LogoIntroScene({ isFading, onFadeStart, onComplete }: Props) {
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live fluctuating matrix cells state
  const [matrixSeed, setMatrixSeed] = useState(0);

  useEffect(() => {
    // Extended schematic display (+2 seconds as requested) then cross-fade to LaunchPanel
    fadeTimerRef.current = setTimeout(() => {
      onFadeStart();
    }, 4600);

    endTimerRef.current = setTimeout(() => {
      onComplete();
    }, 5200);

    // Minor acoustic matrix flicker
    const interval = setInterval(() => {
      setMatrixSeed((s) => (s + 1) % 100);
    }, 250);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      clearInterval(interval);
    };
  }, [onFadeStart, onComplete]);

  const handleSkip = () => {
    onFadeStart();
    setTimeout(onComplete, 400);
  };

  // Matrix generation: 28 cols x 9 rows
  const matrixCols = 28;
  const matrixRows = 9;
  const greenPalette = [
    '#ffffff',
    '#f1f5ec',
    '#dbe5d1',
    '#b8cca7',
    '#8da679',
    '#5e784b',
    '#3e542d',
    '#26381a',
  ];

  // Spectrum waveform columns (42 columns of varying heights)
  const spectrumHeights = [
    12, 11, 4, 3, 2, 2, 2, 8, 10, 11, 6, 4, 3, 3, 3, 4, 3, 2, 2, 4, 3, 2, 3, 2, 4,
    13, 12, 6, 5, 4, 4, 9, 8, 6, 3, 3, 4, 3, 2, 3, 4, 3,
  ];

  return (
    <div
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#f7f8f4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 40px 20px',
        opacity: isFading ? 0 : 1,
        pointerEvents: isFading ? 'none' : 'auto',
        transition: 'opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        cursor: 'pointer',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes radarRipple {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.4); opacity: 0.4; }
        }
      `}</style>

      {/* ─── BACKGROUND SCHEMATIC DASHED GRID GUIDES ─── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Left vertical dashed guide */}
        <div
          style={{
            position: 'absolute',
            left: '20%',
            top: 0,
            bottom: 0,
            borderLeft: '1px dashed rgba(148, 163, 184, 0.4)',
          }}
        />
        {/* Right vertical dashed guide */}
        <div
          style={{
            position: 'absolute',
            right: '20%',
            top: 0,
            bottom: 0,
            borderLeft: '1px dashed rgba(148, 163, 184, 0.4)',
          }}
        />
        {/* Center vertical dashed line */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            borderLeft: '1px dashed rgba(148, 163, 184, 0.3)',
          }}
        />
      </div>

      {/* ─── TOP SECTION: OUR LOGO + ANIMATION + BRAND ─── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 10,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Sonar Ripple Rings behind Logo */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 110,
            height: 110,
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '1.5px solid rgba(56, 189, 248, 0.65)',
              animation: 'radarRipple 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              animation: 'radarRipple 2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
              animationDelay: '0.7s',
            }}
          />
          <img
            src="/logo.png"
            alt="Aqua Sentinel"
            style={{
              height: 72,
              width: 'auto',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 5,
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))',
            }}
          />
        </div>

        {/* Title & Tagline matching minimalist aesthetic */}
        <div
          style={{
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '1.9rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#0f172a',
              lineHeight: 1.15,
            }}
          >
            Autonomous Maritime Mission Intelligence
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: 6,
            }}
          >
            Real-Time Acoustic Telemetry & Object Detection · v1.0
          </div>
        </div>
      </div>

      {/* ─── MIDDLE SECTION: CLEAN REARRANGED ARCHITECTURE MODULES ─── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1080,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
          margin: '16px 0',
          gap: 16,
        }}
      >
        {/* Module 1: Bathymetry */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            transition: 'transform 200ms ease',
          }}
        >
          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            SENSING
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
            Side-Scan Bathymetry
          </div>
        </div>

        {/* Module 2: Classification */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            AI INFERENCE
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
            Target Classification
          </div>
        </div>

        {/* Center: Neural Engine Node */}
        <div
          style={{
            width: 100,
            height: 64,
            background: '#0f172a',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.08em' }}>
            NEURAL
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.12em' }}>
            ENGINE
          </div>
        </div>

        {/* Module 3: 3D Volumetric Mesh */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            MODELING
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
            3D Volumetric Mesh
          </div>
        </div>

        {/* Module 4: Mission Telematics */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            NAVIGATION
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
            Mission Telematics
          </div>
        </div>
      </div>

      {/* ─── BOTTOM SECTION: ACOUSTIC MATRIX & HYDROPHONE FREQUENCY SPECTRUM ─── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1160,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 28,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Bottom Left Chart: ACOUSTIC SENSOR MATRIX (Replacing ANALYSIS) */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              background: '#edf2e7',
              borderBottom: '1px solid #cbd5e1',
              padding: '6px 12px',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#334155',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            Acoustic Sensor Matrix
          </div>

          {/* Matrix Cell Grid (28 columns x 9 rows matching the photo) */}
          <div
            style={{
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: `repeat(${matrixCols}, 1fr)`,
              gap: 2,
              background: '#ffffff',
            }}
          >
            {Array.from({ length: matrixCols * matrixRows }).map((_, idx) => {
              // Deterministic pseudo-random shades mimicking the reference pattern
              const col = idx % matrixCols;
              const row = Math.floor(idx / matrixCols);
              const val = (Math.sin(col * 0.7 + row * 1.3 + matrixSeed * 0.05) + 1) / 2;
              const isCenterCluster = col > 4 && col < 23 && row > 1 && row < 7;
              const paletteIndex = Math.floor(val * (isCenterCluster ? 7 : 4));
              const bgColor = greenPalette[paletteIndex];

              return (
                <div
                  key={idx}
                  style={{
                    aspectRatio: '1/1',
                    background: bgColor,
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: 1,
                    transition: 'background-color 300ms ease',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Right Chart: HYDROPHONE FREQUENCY SPECTRUM (Replacing PREDICTIVE RISK SIGNAL) */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            background: '#e4edd6', // Pale sage green chart canvas matching photo
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              background: '#edf2e7',
              borderBottom: '1px solid #cbd5e1',
              padding: '6px 12px',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#334155',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            Hydrophone Frequency Spectrum
          </div>

          {/* Stacked Circle Dot Histogram (Matching the reference photo exactly) */}
          <div
            style={{
              padding: '10px 14px 6px',
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              minHeight: 110,
            }}
          >
            {spectrumHeights.map((h, colIndex) => {
              // Modulate with minor seed
              const dynamicHeight = Math.max(1, Math.min(14, h + (colIndex % 3 === matrixSeed % 3 ? 1 : 0)));
              return (
                <div
                  key={colIndex}
                  style={{
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    gap: 1.5,
                    alignItems: 'center',
                  }}
                >
                  {Array.from({ length: dynamicHeight }).map((_, dotIdx) => (
                    <div
                      key={dotIdx}
                      style={{
                        width: 5.5,
                        height: 5.5,
                        borderRadius: '50%',
                        border: '1px solid #5a7447',
                        background: dotIdx < 2 ? '#8ba673' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subtle skip prompt */}
      <div
        style={{
          fontSize: '0.62rem',
          color: '#94a3b8',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginTop: 6,
          position: 'relative',
          zIndex: 10,
        }}
      >
        Click anywhere to fast-forward telemetry calibration
      </div>
    </div>
  );
}
