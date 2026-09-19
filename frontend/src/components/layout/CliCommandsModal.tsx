// src/components/layout/CliCommandsModal.tsx
import React, { useState } from 'react';
import { Terminal, Copy, Check, X, Play, Compass, Flame, Clock } from 'lucide-react';

interface CliCommandsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  title: string;
  category: string;
  command: string;
  description: string;
  badge?: string;
}

const COMMANDS: CommandItem[] = [
  {
    title: 'Standard Autonomous Mission Run',
    category: 'Mission Simulation',
    command: 'python test_run.py',
    description: 'Runs submarine patrol on a randomized Indian naval corridor with 30s mission duration and 2 contact anomaly hotspots.',
    badge: 'Recommended',
  },
  {
    title: 'Custom Travel Duration',
    category: 'Mission Simulation',
    command: 'python test_run.py --duration 15',
    description: 'Paces submarine speed so the entire patrol completes in exactly 15 seconds (dynamically calculates frame intervals).',
    badge: 'Dynamic Timing',
  },
  {
    title: 'Specific Naval Route Selection',
    category: 'Corridor Patrol',
    command: 'python test_run.py --route vizag_chennai --duration 20',
    description: 'Executes Bay of Bengal Eastern Fleet Patrol corridor (Visakhapatnam Deep Roads → Chennai Naval Anchorage).',
    badge: 'Corridor Override',
  },
  {
    title: 'Multi-Hotspot Cluster Simulation',
    category: 'Sonar Analytics',
    command: 'python test_run.py --route kutch_mumbai --hotspot-count 3 --duration 30',
    description: 'Simulates 3 distinct anomaly hotspot clusters (minefield barrages, shipwrecks, pipeline fractures) along the Gulf of Kutch to Mumbai corridor.',
    badge: 'Hotspot Focus',
  },
  {
    title: 'Single Sonar Frame Test',
    category: 'Target Validation',
    command: 'python test_run.py --single Test_Data/0001_2010.jpg',
    description: 'Performs immediate multi-scale inference, acoustic shadow gating, 3D metric sizing, and side-by-side export on a single sonar scan.',
  },
  {
    title: 'Custom Confidence & Bounding Box Padding',
    category: 'Target Validation',
    command: 'python test_run.py --conf 0.25 --pad 12 --swath 120.0',
    description: 'Enforces custom AI detection threshold, pixel padding, and sonar swath aperture width.',
  },
  {
    title: 'Lakshadweep Chokepoint Transit',
    category: 'Corridor Patrol',
    command: 'python test_run.py --route lakshadweep --duration 15',
    description: 'Patrols the Eight Degree Channel deep water corridor between Kochi Naval Base and Minicoy Island.',
  },
  {
    title: 'Start FastAPI Backend Server',
    category: 'System Service',
    command: 'python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000',
    description: 'Starts FastAPI server with live YOLO inference engine, model fallback, and Server-Sent Events broadcaster.',
  },
  {
    title: 'Start Vite Web Application',
    category: 'System Service',
    command: 'npm run dev',
    description: 'Starts the React tactical UI with interactive Leaflet map, canvas heatmap, and spatial clustering.',
  },
];

export function CliCommandsModal({ isOpen, onClose }: CliCommandsModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 780,
          maxHeight: '85vh',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <Terminal size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                Aqua Sentinel — Mission CLI & Terminal Commands
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Run any command in PowerShell or CMD. Results broadcast live to this browser map in real-time.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Feature Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            padding: '12px 20px',
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            fontSize: '0.70rem',
            color: '#334155',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color="#0284c7" />
            <span>Dynamic Travel Duration (--duration)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Compass size={13} color="#16a34a" />
            <span>4 Random Naval Corridors (--route)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={13} color="#ea580c" />
            <span>Anomaly Hotspot Clusters (--hotspots)</span>
          </div>
        </div>

        {/* Command List Scrollable */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {COMMANDS.map((item, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '12px 14px',
                background: '#ffffff',
                transition: 'all 150ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#0f172a' }}>
                    {item.title}
                  </span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#e0f2fe',
                        color: '#0369a1',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 600 }}>
                  {item.category}
                </span>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>
                {item.description}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#0f172a',
                  color: '#38bdf8',
                  borderRadius: 8,
                  padding: '7px 12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.74rem',
                }}
              >
                <code style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginRight: 10 }}>
                  {item.command}
                </code>
                <button
                  onClick={() => handleCopy(item.command, idx)}
                  style={{
                    border: 'none',
                    background: copiedIndex === idx ? '#16a34a' : 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    transition: 'all 150ms ease',
                  }}
                  title="Copy command to clipboard"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check size={11} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#64748b',
          }}
        >
          <span>Tip: When you run these commands in terminal, the submarine moves live on the map!</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
