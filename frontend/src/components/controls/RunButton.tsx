// src/components/controls/RunButton.tsx
import React from 'react';
import { ScanLine, Loader2, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { useAnalysis } from '../../hooks/useAnalysis';

export function RunButton() {
  const { state, dispatch } = useAppContext();
  const { runAnalysis, status } = useAnalysis();

  const canRun = !!state.sonarFile && status !== 'uploading' && status !== 'processing';
  const isRunning = status === 'uploading' || status === 'processing';
  const isDone = status === 'complete';
  const isError = status === 'error';

  const handleReset = () => dispatch({ type: 'RESET' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        id="run-analysis-btn"
        onClick={runAnalysis}
        disabled={!canRun}
        style={{
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          padding: '13px 20px',
          border: 'none',
          background: canRun
            ? '#0f172a'
            : '#f1f5f9',
          color: canRun ? '#ffffff' : '#94a3b8',
          fontSize: '0.82rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          cursor: canRun ? 'pointer' : 'not-allowed',
          boxShadow: canRun ? '0 4px 14px rgba(15, 23, 42, 0.18)' : 'none',
          transition: 'all 200ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => {
          if (canRun) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 23, 42, 0.28)';
          }
        }}
        onMouseLeave={(e) => {
          if (canRun) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.18)';
          }
        }}
        aria-label="Run sonar analysis"
      >
        {/* Scanline sweep while running */}
        {isRunning && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              animation: 'scanSweep 1.5s linear infinite',
              backgroundSize: '200% 100%',
            }}
          />
        )}
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7 }}>
          {isRunning ? (
            <>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              {status === 'uploading' ? 'Uploading Sonar...' : 'Processing Pipeline...'}
            </>
          ) : (
            <>
              <ScanLine size={15} />
              <span>Analyze Sonar</span>
            </>
          )}
        </span>
      </button>

      {/* Status messages */}
      {isDone && state.result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <CheckCircle size={14} color="#15803d" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', flex: 1 }}>
            {state.result.detections.length} detections in {state.result.processing_meta.processing_time_ms}ms
          </span>
          <button onClick={handleReset} aria-label="Reset analysis" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d' }}>
            <RotateCcw size={13} />
          </button>
        </div>
      )}

      {isError && state.error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <AlertTriangle size={14} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c' }}>{state.error}</span>
        </div>
      )}

      {!state.sonarFile && (
        <p style={{ fontSize: '0.6875rem', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
          Load a sonar file to enable analysis
        </p>
      )}
    </div>
  );
}
