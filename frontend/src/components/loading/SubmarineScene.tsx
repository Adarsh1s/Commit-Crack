// src/components/loading/SubmarineScene.tsx
import React, { useEffect, useState } from 'react';

interface SubmarineSceneProps {
  onComplete: () => void;
}

export function SubmarineScene({ onComplete }: SubmarineSceneProps) {
  const [showPing, setShowPing] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  useEffect(() => {
    // Show sonar ping when sub enters
    const t1 = setTimeout(() => setShowPing(true), 400);
    const t2 = setTimeout(() => setShowPing(false), 2000);
    const t3 = setTimeout(() => setTitleVisible(true), 900);
    const t4 = setTimeout(() => setSubtitleVisible(true), 1400);
    const t5 = setTimeout(onComplete, 4000);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="loading-screen">
      {/* Background overlays */}
      <div className="scanline-overlay" />
      <div className="phosphor-grid" />

      {/* Sonar ping at entry point (top-right area) */}
      {showPing && (
        <div
          style={{
            position: 'absolute',
            top: '10%',
            right: '10%',
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid rgba(34,211,238,0.8)',
            animation: 'pingSonar 1.6s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        />
      )}

      {/* Submarine with bubble trail */}
      <div className="submarine-wrapper">
        {/* Bubble trail */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 4 + (i % 3) * 2,
              height: 4 + (i % 3) * 2,
              borderRadius: '50%',
              background: 'rgba(34, 211, 238, 0.4)',
              right: -10 - i * 12,
              top: 20 + (i % 2) * 8,
              animation: `bubbleRise ${0.8 + i * 0.2}s ease-out ${i * 0.15}s infinite`,
            }}
          />
        ))}

        {/* SVG Submarine */}
        <svg width="120" height="48" viewBox="0 0 120 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Hull */}
          <ellipse cx="58" cy="28" rx="52" ry="16" fill="#0e4f6e" stroke="#22d3ee" strokeWidth="1.2" />
          {/* Conning tower */}
          <rect x="42" y="10" width="28" height="18" rx="4" fill="#0d1929" stroke="#22d3ee" strokeWidth="1" />
          {/* Periscope */}
          <rect x="54" y="4" width="3" height="9" rx="1" fill="#22d3ee" />
          <rect x="50" y="4" width="10" height="2.5" rx="1" fill="#22d3ee" />
          {/* Propeller */}
          <circle cx="106" cy="28" r="6" fill="none" stroke="#22d3ee" strokeWidth="1.2" />
          <line x1="106" y1="22" x2="106" y2="34" stroke="#22d3ee" strokeWidth="1.5" />
          <line x1="100" y1="28" x2="112" y2="28" stroke="#22d3ee" strokeWidth="1.5" />
          {/* Nose light */}
          <circle cx="9" cy="28" r="3" fill="#22d3ee" opacity="0.9" />
          <ellipse cx="5" cy="28" rx="5" ry="2" fill="rgba(34,211,238,0.2)" />
          {/* Porthole */}
          <circle cx="72" cy="28" r="5" fill="#0a1f33" stroke="#22d3ee" strokeWidth="1" />
          <circle cx="50" cy="28" r="4" fill="#0a1f33" stroke="#22d3ee" strokeWidth="1" />
          {/* Torpedo tubes */}
          <rect x="4" y="24" width="10" height="4" rx="2" fill="#0ea5c8" opacity="0.7" />
          <rect x="4" y="30" width="8" height="3" rx="1.5" fill="#0ea5c8" opacity="0.5" />
          {/* Fin */}
          <polygon points="85,28 100,20 100,36" fill="#0e4f6e" stroke="#22d3ee" strokeWidth="0.8" />
          {/* Glow under hull */}
          <ellipse cx="58" cy="42" rx="30" ry="4" fill="rgba(14,165,200,0.08)" />
        </svg>
      </div>

      {/* Depth lines */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 1,
            background: `rgba(14, 165, 200, ${0.03 + i * 0.01})`,
            top: `${20 + i * 15}%`,
          }}
        />
      ))}

      {/* App branding */}
      <div className="relative z-10 flex flex-col items-center gap-3" style={{ marginTop: 40 }}>
        <div
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <span className="text-label" style={{ color: '#7a9abf', letterSpacing: '0.18em' }}>SONAR OBJECT DETECTION</span>
            <div style={{ width: 36, height: 2, background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          <h1
            style={{
              fontFamily: 'Inter',
              fontSize: '3.5rem',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: '#e2eaf4',
              margin: 0,
              textAlign: 'center',
            }}
          >
            SONAR
            <span style={{ color: '#22d3ee' }}>·</span>
            OS
          </h1>
        </div>

        <div
          style={{
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
          }}
        >
          <p
            style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.75rem',
              color: '#3d5a7a',
              letterSpacing: '0.12em',
              textAlign: 'center',
              margin: 0,
            }}
          >
            MARITIME SONAR ANALYSIS PLATFORM · v1.0.0
          </p>
        </div>
      </div>

      {/* Corner decorations */}
      <div style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderTop: '2px solid rgba(14,165,200,0.4)', borderLeft: '2px solid rgba(14,165,200,0.4)' }} />
      <div style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderTop: '2px solid rgba(14,165,200,0.4)', borderRight: '2px solid rgba(14,165,200,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderBottom: '2px solid rgba(14,165,200,0.4)', borderLeft: '2px solid rgba(14,165,200,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderBottom: '2px solid rgba(14,165,200,0.4)', borderRight: '2px solid rgba(14,165,200,0.4)' }} />

      {/* Bottom status bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: subtitleVisible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.5s',
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', animation: 'cursorBlink 1s step-start infinite' }} />
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6875rem', color: '#3d5a7a', letterSpacing: '0.1em' }}>
          INITIALIZING SYSTEMS...
        </span>
      </div>
    </div>
  );
}
