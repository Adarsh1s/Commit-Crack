// src/components/loading/LaunchPanel.tsx
// Hyper-realistic sci-fi hardware motherboard & cyber-deck control console.
// Incorporates multi-layered 3D chassis depth, embossed panel cuts, screw rivets,
// segmented dual-rail glowing bus tracks with ladder rungs, cantilevered shelf blades with PCB gold pins,
// dual microchips, SMD capacitors, heatsink bays, and dual-layer central compute module.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu, Layers, Zap, Check, ChevronLeft, ChevronRight,
  ShieldCheck, Loader2, Navigation
} from 'lucide-react';
import type { ComputeTier, GeoCoordinate, SystemInfo } from '../../types/sonar';
import { detectComputeTier } from '../../utils/computeTier';
import { formatCoord } from '../../utils/formatters';

interface Props {
  systemInfo: SystemInfo;
  onConfirm: (tier: ComputeTier, location: GeoCoordinate | null) => void;
  visible?: boolean;
}

type LocState =
  | { phase: 'fetching' }
  | { phase: 'granted'; location: GeoCoordinate }
  | { phase: 'denied'; message: string };

export function LaunchPanel({ systemInfo, onConfirm, visible = true }: Props) {
  const autoTier = detectComputeTier(systemInfo);
  const [tier, setTier] = useState<ComputeTier>(autoTier);
  const [userSelected, setUserSelected] = useState(false);
  const [locState, setLocState] = useState<LocState>({ phase: 'fetching' });

  // Update tier when autoTier is detected unless user manually selected one
  useEffect(() => {
    if (!userSelected) {
      setTier(autoTier);
    }
  }, [autoTier, userSelected]);

  // Acquire geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocState({ phase: 'denied', message: 'Geolocation not supported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setLocState({ phase: 'granted', location: { lat: p.coords.latitude, lon: p.coords.longitude } }),
      (e) => {
        const m: Record<number, string> = { 1: 'Location access denied', 2: 'No GPS signal', 3: 'Request timed out' };
        setLocState({ phase: 'denied', message: m[e.code] ?? 'Location unavailable' });
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const handleConfirm = useCallback(() => {
    const loc = locState.phase === 'granted' ? locState.location : null;
    onConfirm(tier, loc);
  }, [tier, locState, onConfirm]);

  const cleanGpu = systemInfo.gpuName
    ? systemInfo.gpuName
    : systemInfo.gpuRenderer
    ? systemInfo.gpuRenderer.replace(/^ANGLE \([^,]+,\s*(.+?)\s*Direct3D.*?\)$/i, '$1').replace(/^ANGLE \((.+?)\)$/i, '$1').replace(/\(R\)/gi, '®').replace(/\(TM\)/gi, '™')
    : 'Hardware Accelerated';

  const displayRam = systemInfo.ramTotalGb != null
    ? `${Math.round(systemInfo.ramTotalGb)} GB`
    : systemInfo.deviceMemoryGb != null
    ? `${systemInfo.deviceMemoryGb} GB`
    : '8 GB';

  const displayCpu = `${systemInfo.cpuCores} Cores`;
  const cpuSubtitle = systemInfo.cpuName
    ? systemInfo.cpuName.length > 28
      ? systemInfo.cpuName.slice(0, 26) + '…'
      : systemInfo.cpuName
    : systemInfo.cpuCores >= 4
    ? 'Multi-thread enabled'
    : 'Single-thread mode';

  const tierDetails = {
    A: {
      name: 'TIER A',
      sub: 'HIGH PERFORMANCE',
      specs: '12ms · 98% Throughput',
      badge: '4K RES · MULTI-THREAD',
      desc: 'Full acoustic resolution and ultra-low latency real-time inference.',
    },
    B: {
      name: 'TIER B',
      sub: 'BALANCED INFERENCE',
      specs: '24ms · 82% Throughput',
      badge: 'RECOMMENDED',
      desc: 'Standard resolution with optimized single-thread batch processing.',
    },
    C: {
      name: 'TIER C',
      sub: 'LOW POWER MODE',
      specs: '45ms · 56% Throughput',
      badge: 'POWER EFFICIENCY',
      desc: 'Compressed resolution and minimal resource consumption for long voyages.',
    },
  };

  // Reusable Screw Rivet Component
  const ScrewRivet = ({ style }: { style?: React.CSSProperties }) => (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #cbd5e1 55%, #64748b 100%)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.9)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <div style={{ width: 5, height: 1, background: '#475569' }} />
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        backgroundColor: '#F7F8F4',
        backgroundImage: `
          radial-gradient(circle at 50% 20%, #ffffff 0%, #F7F8F4 60%, #eef0ea 100%)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px 16px',
        overflowY: 'auto',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#1e293b',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes busLadderFlow {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes ambientGlowPulse {
          0%, 100% { opacity: 0.95; filter: drop-shadow(0 0 8px rgba(255, 87, 34, 0.9)); }
          50% { opacity: 0.6; filter: drop-shadow(0 0 3px rgba(255, 87, 34, 0.4)); }
        }
      `}</style>

      {/* ─── BACKGROUND CHASSIS MECHANICAL ENGRAVINGS & BEVEL PLATES ─── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Top-left diagonal chassis cut plate */}
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: -20,
            width: 260,
            height: 100,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(226,232,240,0.5) 100%)',
            borderBottomRightRadius: 40,
            borderRight: '1px solid #ffffff',
            borderBottom: '1px solid #ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        />

        {/* Top-right large diagonal panel overlay held down by corner screw rivets */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 28,
            width: 380,
            height: 480,
            background: 'linear-gradient(175deg, rgba(248, 250, 252, 0.6) 0%, rgba(226, 232, 240, 0.4) 100%)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: 'inset 1px 1px 0 #ffffff, 0 8px 24px rgba(0,0,0,0.03)',
          }}
        >
          <ScrewRivet style={{ position: 'absolute', top: 12, right: 12 }} />
          <ScrewRivet style={{ position: 'absolute', bottom: 12, right: 12 }} />
          <ScrewRivet style={{ position: 'absolute', bottom: 12, left: 12 }} />
        </div>

        {/* Top center chassis screws & ventilation slots */}
        <div style={{ position: 'absolute', top: 72, left: '38%', display: 'flex', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 14,
                borderRadius: 1.5,
                background: '#475569',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 #ffffff',
              }}
            />
          ))}
          <ScrewRivet style={{ marginLeft: 8 }} />
        </div>

        {/* Top center-right ventilation slots and screws */}
        <div style={{ position: 'absolute', top: 72, right: '35%', display: 'flex', gap: 6, alignItems: 'center' }}>
          <ScrewRivet style={{ marginRight: 8 }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 14,
                borderRadius: 1.5,
                background: '#475569',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 #ffffff',
              }}
            />
          ))}
        </div>

        {/* Bottom-right 3 SMD capacitor blocks */}
        <div style={{ position: 'absolute', bottom: 60, right: '33%', display: 'flex', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 28,
                background: '#1e293b',
                borderRadius: 3,
                boxShadow: '0 3px 6px rgba(0,0,0,0.25)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#94a3b8', borderRadius: '3px 3px 0 0' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: '#94a3b8', borderRadius: '0 0 3px 3px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── TOP BAR: OUR LOGO + BRAND + SCREW MOUNTS (NO SERVICES, ABOUT US, NEWS) ─── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 1px 0 rgba(148, 163, 184, 0.2)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="/logo.png"
            alt="Aqua Sentinel"
            style={{
              height: 44,
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.14))',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#0f172a',
                lineHeight: 1.1,
              }}
            >
              Aqua Sentinel
            </span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Autonomous Maritime Telemetry & Detection
            </span>
          </div>
        </div>

        {/* Motherboard status & PCB Revision stamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 10px #10b981, 0 0 20px rgba(16, 185, 129, 0.5)',
              }}
            />
            <span style={{ fontSize: '0.70rem', fontWeight: 800, letterSpacing: '0.12em', color: '#334155' }}>
              SYS-RDY · 100% CALIBRATED
            </span>
          </div>
          <ScrewRivet />
        </div>
      </div>

      {/* ─── MAIN HARDWARE CHASSIS MOTHERBOARD ─── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1280,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '320px 1fr 350px',
          alignItems: 'center',
          gap: 20,
          position: 'relative',
          padding: '16px 0',
          zIndex: 5,
        }}
      >
        {/* ═══ COLUMN 1: LEFT COMPONENT CARDS, HEATSINK BAY & IC CHIPS ═══ */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative', zIndex: 10 }}>
          {/* Recessed Left Heatsink Bay with Stamped Modular Heatsinks */}
          <div
            style={{
              padding: '8px 6px',
              background: 'linear-gradient(180deg, #d8e1ea 0%, #cbd5e1 100%)',
              borderRadius: 14,
              boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.12), inset -1px -1px 3px #ffffff',
              border: '1px solid rgba(255,255,255,0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <ScrewRivet style={{ width: 8, height: 8 }} />

            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                style={{
                  width: 48,
                  height: 88,
                  background: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
                  borderRadius: 8,
                  border: '1px solid #ffffff',
                  boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.9), 0 4px 8px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 0',
                }}
              >
                {/* 5 horizontal heatsink fin cuts */}
                {[0, 1, 2, 3, 4].map((fin) => (
                  <div
                    key={fin}
                    style={{
                      width: 30,
                      height: 3,
                      borderRadius: 1.5,
                      background: '#94a3b8',
                      boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.3), 0 1px 0 #ffffff',
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Bottom-left Dual SOP-8 IC microchips with silver lead pins */}
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {[0, 1].map((chip) => (
                <div
                  key={chip}
                  style={{
                    width: 22,
                    height: 18,
                    background: '#0f172a',
                    borderRadius: 3,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Lead pins top & bottom */}
                  <div style={{ position: 'absolute', top: -3, left: 2, right: 2, display: 'flex', justifyContent: 'space-between' }}>
                    {[0, 1, 2, 3].map((p) => (
                      <div key={p} style={{ width: 2, height: 3, background: '#cbd5e1', boxShadow: '0 -1px 0 #94a3b8' }} />
                    ))}
                  </div>
                  <div style={{ position: 'absolute', bottom: -3, left: 2, right: 2, display: 'flex', justifyContent: 'space-between' }}>
                    {[0, 1, 2, 3].map((p) => (
                      <div key={p} style={{ width: 2, height: 3, background: '#cbd5e1', boxShadow: '0 1px 0 #94a3b8' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Silk-screen tiny label */}
            <div style={{ fontSize: '0.42rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>
              REV-4.2
            </div>
          </div>

          {/* 3 Main Hardware Spec Cards (Replacing Customer Data, Merchant Data, Transaction Log) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            {/* Card 1: COMPUTE CORES */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '12px 16px',
                boxShadow: `
                  0 16px 36px -6px rgba(50, 65, 85, 0.14),
                  0 4px 10px rgba(0, 0, 0, 0.04),
                  inset 1px 1px 0 #ffffff
                `,
                border: '1px solid rgba(255, 255, 255, 0.95)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    background: '#141a24',
                    borderRadius: 7,
                    padding: '5px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  <Cpu size={14} color="#38bdf8" />
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>CPU-CORE</span>
                </div>
                {/* Glowing neon amber status LED */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ff5722',
                    boxShadow: '0 0 10px #ff5722, 0 0 20px rgba(255, 87, 34, 0.5)',
                    animation: 'ambientGlowPulse 2.5s infinite',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase' }}>
                  Compute Cores
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginTop: 1 }}>
                  {displayCpu}
                </div>
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#10b981',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={systemInfo.cpuName || `${systemInfo.cpuCores} Cores`}
                >
                  {cpuSubtitle}
                </div>
              </div>
            </div>

            {/* Card 2: DEVICE MEMORY */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '12px 16px',
                boxShadow: `
                  0 16px 36px -6px rgba(50, 65, 85, 0.14),
                  0 4px 10px rgba(0, 0, 0, 0.04),
                  inset 1px 1px 0 #ffffff
                `,
                border: '1px solid rgba(255, 255, 255, 0.95)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    background: '#141a24',
                    borderRadius: 7,
                    padding: '5px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  <Layers size={14} color="#38bdf8" />
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>MEM-HEAP</span>
                </div>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ff5722',
                    boxShadow: '0 0 10px #ff5722, 0 0 20px rgba(255, 87, 34, 0.5)',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase' }}>
                  Device Memory
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginTop: 1 }}>
                  {displayRam}
                </div>
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#3b82f6',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {systemInfo.ramAvailableGb != null
                    ? `${systemInfo.ramAvailableGb} GB Free · Dedicated`
                    : `Dedicated Heap · ${systemInfo.sharedArrayBuffer ? 'SAB Ready' : 'SingleThread'}`}
                </div>
              </div>
            </div>

            {/* Card 3: GPU ENGINE */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '12px 16px',
                boxShadow: `
                  0 16px 36px -6px rgba(50, 65, 85, 0.14),
                  0 4px 10px rgba(0, 0, 0, 0.04),
                  inset 1px 1px 0 #ffffff
                `,
                border: '1px solid rgba(255, 255, 255, 0.95)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    background: '#141a24',
                    borderRadius: 7,
                    padding: '5px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  <Zap size={14} color="#38bdf8" />
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.05em' }}>GPU-ACCEL</span>
                </div>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ff5722',
                    boxShadow: '0 0 10px #ff5722, 0 0 20px rgba(255, 87, 34, 0.5)',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase' }}>
                  GPU Engine
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginTop: 1 }}>
                  {systemInfo.vramGb != null ? `${systemInfo.vramGb} GB VRAM` : 'WebGL Active'}
                </div>
                <div
                  style={{
                    fontSize: '0.60rem',
                    fontWeight: 600,
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                  title={cleanGpu}
                >
                  {cleanGpu}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ COLUMN 2: CENTER COMPUTATION UNIT (THE VECTOR COMPUTER -> VESSEL COORDINATES) ═══ */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* ─── SVG SEGMENTED DUAL-RAIL GLOWING CIRCUIT BUS TRACKS (MATCHING REFERENCE PHOTO) ─── */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
              zIndex: 2,
            }}
          >
            <defs>
              <linearGradient id="busGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff5722" />
                <stop offset="100%" stopColor="#ff9800" />
              </linearGradient>
              <linearGradient id="busGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff9800" />
                <stop offset="100%" stopColor="#ff5722" />
              </linearGradient>
            </defs>

            {/* Left bus tracks (Chassis embossed groove + Segmented ladder rungs) */}
            <g>
              {/* Top left bus trace */}
              <path
                d="M -10, 85 L 20, 85 L 45, 145 L 85, 145"
                fill="none"
                stroke="#c9d4df"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M -10, 85 L 20, 85 L 45, 145 L 85, 145"
                fill="none"
                stroke="#eef4fa"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M -10, 85 L 20, 85 L 45, 145 L 85, 145"
                fill="none"
                stroke="url(#busGradLeft)"
                strokeWidth="3.5"
                strokeDasharray="4 8"
                style={{ animation: 'busLadderFlow 1s linear infinite' }}
              />
              {/* Copper solder pad */}
              <circle cx="85" cy="145" r="5.5" fill="#ff5722" stroke="#ffffff" strokeWidth="2" />

              {/* Middle left bus trace */}
              <path
                d="M -10, 195 L 85, 195"
                fill="none"
                stroke="#c9d4df"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M -10, 195 L 85, 195"
                fill="none"
                stroke="#eef4fa"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M -10, 195 L 85, 195"
                fill="none"
                stroke="url(#busGradLeft)"
                strokeWidth="3.5"
                strokeDasharray="4 8"
                style={{ animation: 'busLadderFlow 1s linear infinite', animationDelay: '0.25s' }}
              />
              <circle cx="85" cy="195" r="5.5" fill="#ff5722" stroke="#ffffff" strokeWidth="2" />

              {/* Bottom left bus trace */}
              <path
                d="M -10, 305 L 20, 305 L 45, 245 L 85, 245"
                fill="none"
                stroke="#c9d4df"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M -10, 305 L 20, 305 L 45, 245 L 85, 245"
                fill="none"
                stroke="#eef4fa"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M -10, 305 L 20, 305 L 45, 245 L 85, 245"
                fill="none"
                stroke="url(#busGradLeft)"
                strokeWidth="3.5"
                strokeDasharray="4 8"
                style={{ animation: 'busLadderFlow 1s linear infinite', animationDelay: '0.5s' }}
              />
              <circle cx="85" cy="245" r="5.5" fill="#ff5722" stroke="#ffffff" strokeWidth="2" />
            </g>

            {/* Right bus tracks (connecting center processor to right tier blades) */}
            <g transform="translate(385, 0)">
              {/* Top right bus trace */}
              <path
                d="M 15, 145 L 55, 145 L 80, 85 L 125, 85"
                fill="none"
                stroke="#c9d4df"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M 15, 145 L 55, 145 L 80, 85 L 125, 85"
                fill="none"
                stroke="#eef4fa"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M 15, 145 L 55, 145 L 80, 85 L 125, 85"
                fill="none"
                stroke="url(#busGradRight)"
                strokeWidth="3.5"
                strokeDasharray="4 8"
                style={{ animation: 'busLadderFlow 1s linear infinite' }}
              />
              <circle cx="15" cy="145" r="5.5" fill="#ff5722" stroke="#ffffff" strokeWidth="2" />

              {/* Middle right bus trace */}
              <path
                d="M 15, 195 L 125, 195"
                fill="none"
                stroke="#c9d4df"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M 15, 195 L 125, 195"
                fill="none"
                stroke="#eef4fa"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M 15, 195 L 125, 195"
                fill="none"
                stroke="url(#busGradRight)"
                strokeWidth="3.5"
                strokeDasharray="4 8"
                style={{ animation: 'busLadderFlow 1s linear infinite', animationDelay: '0.35s' }}
              />
              <circle cx="15" cy="195" r="5.5" fill="#ff5722" stroke="#ffffff" strokeWidth="2" />

              {/* Bottom right bus trace */}
              <path
                d="M 15, 245 L 55, 245 L 80, 305 L 125, 305"
                fill="none"
                stroke="#c9d4df"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M 15, 245 L 55, 245 L 80, 305 L 125, 305"
                fill="none"
                stroke="#eef4fa"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M 15, 245 L 55, 245 L 80, 305 L 125, 305"
                fill="none"
                stroke="url(#busGradRight)"
                strokeWidth="3.5"
                strokeDasharray="4 8"
                style={{ animation: 'busLadderFlow 1s linear infinite', animationDelay: '0.65s' }}
              />
              <circle cx="15" cy="245" r="5.5" fill="#ff5722" stroke="#ffffff" strokeWidth="2" />
            </g>
          </svg>

          {/* Top 5 ventilation slots above central processor */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, zIndex: 4 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 3.5,
                  height: 14,
                  borderRadius: 2,
                  background: '#334155',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 #ffffff',
                }}
              />
            ))}
          </div>

          {/* ─── DUAL-LAYER STACKED CENTRAL PROCESSOR UNIT ("THE VECTOR COMPUTER") ─── */}
          {/* Layer 1: Base sub-chassis plate with soft shadow */}
          <div
            style={{
              width: 340,
              padding: '6px',
              background: 'linear-gradient(175deg, #d8e2ec 0%, #cbd5e1 100%)',
              borderRadius: 28,
              border: '1px solid rgba(255,255,255,0.85)',
              boxShadow: `
                0 30px 70px -15px rgba(45, 55, 72, 0.28),
                0 10px 25px rgba(0, 0, 0, 0.06),
                inset 1px 1px 2px rgba(255, 255, 255, 0.9)
              `,
              position: 'relative',
              zIndex: 5,
            }}
          >
            {/* Layer 2: Raised Upper White Module Block */}
            <div
              style={{
                width: '100%',
                background: 'linear-gradient(175deg, #ffffff 0%, #f6f9fc 100%)',
                borderRadius: 22,
                padding: '26px 22px 22px',
                border: '1px solid #ffffff',
                boxShadow: `
                  0 12px 30px rgba(0, 0, 0, 0.05),
                  inset 1px 1px 2px rgba(255, 255, 255, 0.95)
                `,
                position: 'relative',
              }}
            >
              {/* Top 3 orange status markers (from photo) */}
              <div style={{ position: 'absolute', top: 12, left: 22, display: 'flex', gap: 3.5 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 3.5,
                      height: 10,
                      borderRadius: 2,
                      background: '#ff5722',
                      boxShadow: '0 0 6px #ff5722',
                    }}
                  />
                ))}
              </div>

              {/* Top right embossed badge with GPS Lock status */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 18,
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(145deg, #f8fafc, #e2e8f0)',
                  border: '1px solid #ffffff',
                  boxShadow: 'inset 1px 1px 2px #ffffff, 0 3px 6px rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {locState.phase === 'granted' ? (
                  <ShieldCheck size={20} color="#10b981" />
                ) : locState.phase === 'fetching' ? (
                  <Loader2 size={18} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Navigation size={18} color="#f59e0b" />
                )}
              </div>

              {/* Central Block Title: "VESSEL COORDINATES" (Styled exactly like "THE VECTOR COMPUTER") */}
              <div style={{ marginTop: 12, marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: '1.55rem',
                    fontWeight: 900,
                    letterSpacing: '-0.035em',
                    color: '#0f172a',
                    lineHeight: 1.05,
                    textTransform: 'uppercase',
                  }}
                >
                  VESSEL
                  <br />
                  COORDINATES
                </div>

                {/* Coordinates display readout */}
                <div
                  style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderRadius: 9,
                    border: '1px solid #e2e8f0',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: locState.phase === 'granted' ? '#10b981' : '#f59e0b',
                      color: '#ffffff',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {locState.phase === 'granted' ? 'LOCK' : 'SEARCH'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: "'SF Mono', Monaco, monospace",
                    }}
                  >
                    {locState.phase === 'granted'
                      ? `${formatCoord(locState.location.lat, true)} · ${formatCoord(locState.location.lon, false)}`
                      : '21.284858° N · 74.844429° E'}
                  </span>
                </div>

                {/* Subtitle matching "The only compute platform your vector retrieval stack needs" */}
                <div
                  style={{
                    marginTop: 12,
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: '#64748b',
                    lineHeight: 1.45,
                  }}
                >
                  The autonomous acoustic telemetry and inference platform configured for real-time maritime missions.
                </div>
              </div>

              {/* ─── BOTTOM RECESSED COCKPIT SLOT: < INITIALIZE MISSION > (REPLACING "FRAUD DETECTION") ─── */}
              <div
                style={{
                  marginTop: 20,
                  background: '#dbe3ec',
                  borderRadius: 14,
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.14), 0 1px 0 #ffffff',
                }}
              >
                {/* Left bracket button */}
                <button
                  type="button"
                  style={{
                    width: 30,
                    height: 44,
                    borderRadius: 9,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={18} />
                </button>

                {/* High-visibility Mission Activation Button */}
                <button
                  onClick={handleConfirm}
                  style={{
                    flex: 1,
                    height: 44,
                    background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: 9,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.4)',
                    transition: 'all 180ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(180deg, #0f172a 0%, #020617 100%)';
                    e.currentTarget.style.boxShadow = '0 0 24px rgba(56, 189, 248, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.4)';
                  }}
                >
                  Initialize Mission
                </button>

                {/* Right bracket button */}
                <button
                  type="button"
                  style={{
                    width: 30,
                    height: 44,
                    borderRadius: 9,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom chassis card drive slot with metallic rim */}
          <div
            style={{
              width: 220,
              height: 5,
              borderRadius: 2.5,
              background: '#0f172a',
              border: '1px solid #ffffff',
              boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.8)',
              marginTop: 14,
              zIndex: 4,
            }}
          />

          {/* Bottom stamped chip pad */}
          <div
            style={{
              width: 36,
              height: 26,
              borderRadius: 7,
              background: 'linear-gradient(145deg, #f8fafc, #cbd5e1)',
              border: '1px solid #ffffff',
              boxShadow: '0 3px 6px rgba(0,0,0,0.08), inset 1px 1px 0 #ffffff',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.50rem',
              fontWeight: 900,
              color: '#475569',
              letterSpacing: '0.05em',
              zIndex: 4,
            }}
          >
            SYS
          </div>
        </div>

        {/* ═══ COLUMN 3: RIGHT CANTILEVERED SHELVES & TIER BLADES (WITH PCB CONNECTOR PINS) ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 10 }}>
          {(['A', 'B', 'C'] as ComputeTier[]).map((t, idx) => {
            const isSel = tier === t;
            const details = tierDetails[t];
            const isLast = idx === 2;
            const isRecommended = autoTier === t;

            return (
              <div key={t} style={{ position: 'relative' }}>
                {/* Floating Shelf Platform Base (from photo) */}
                <div
                  onClick={() => {
                    setTier(t);
                    setUserSelected(true);
                  }}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    padding: '14px 18px',
                    boxShadow: isSel
                      ? '0 16px 36px -4px rgba(255, 87, 34, 0.3), 0 4px 12px rgba(0,0,0,0.06)'
                      : '0 14px 30px -5px rgba(50, 65, 85, 0.16), 0 3px 8px rgba(0,0,0,0.04)',
                    border: isSel ? '2px solid #ff5722' : '1px solid rgba(255, 255, 255, 0.95)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 200ms ease',
                    transform: isSel ? 'translateX(6px)' : 'translateX(0)',
                  }}
                >
                  {/* Left double orange LED indicators on shelf ledge (from photo) */}
                  <div style={{ position: 'absolute', top: 18, left: -9, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isSel ? '#ff5722' : '#cbd5e1',
                        boxShadow: isSel ? '0 0 8px #ff5722' : 'none',
                      }}
                    />
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isSel ? '#ff5722' : '#cbd5e1',
                        boxShadow: isSel ? '0 0 8px #ff5722' : 'none',
                      }}
                    />
                  </div>

                  {/* Top header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        COMPUTE TIER
                      </span>
                      <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
                        {details.name} · {details.sub}
                      </div>
                    </div>

                    {/* Dark screen readout insert (from reference photo) */}
                    <div
                      style={{
                        background: '#141a24',
                        borderRadius: 7,
                        padding: '5px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: isSel ? '#ff7043' : '#94a3b8',
                          fontFamily: "'SF Mono', Monaco, monospace",
                        }}
                      >
                        {details.specs}
                      </span>
                      {isSel && <Check size={12} color="#10b981" />}
                    </div>
                  </div>

                  {/* Badge and description */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 500, color: '#64748b', lineHeight: 1.3 }}>
                      {details.desc}
                    </span>
                    {isRecommended && (
                      <span
                        style={{
                          fontSize: '0.54rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#e0f2fe',
                          color: '#0284c7',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                </div>

                {/* Exposed Gold PCB Connector Pins on bottom blade (from photo) */}
                {isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      left: 36,
                      display: 'flex',
                      gap: 4,
                      zIndex: 1,
                    }}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((p) => (
                      <div
                        key={p}
                        style={{
                          width: 3,
                          height: 8,
                          background: 'linear-gradient(180deg, #d97706 0%, #f59e0b 100%)',
                          borderRadius: '0 0 1.5px 1.5px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── BOTTOM CHASSIS SEAM: HARDWARE INFO FOOTER ─── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 -1px 0 rgba(148, 163, 184, 0.2)',
          fontSize: '0.68rem',
          color: '#475569',
          fontWeight: 700,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 20 }}>
          <span>DISPLAY VIEWPORT: {systemInfo.screenWidth} × {systemInfo.screenHeight}</span>
          <span>HARDWARE ENGINE: WEBGL ACCELERATED</span>
          <span>AIR-GAP INTEGRITY: VERIFIED</span>
        </div>
        <div>
          <span>MARITIME TELEMETRY BUS · REV 4.2.0 · AQUA SENTINEL OS</span>
        </div>
      </div>
    </div>
  );
}
