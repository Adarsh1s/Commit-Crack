// src/components/controls/RunButton.tsx
import React from 'react';
import { ScanLine, Loader2, CheckCircle, AlertTriangle, RotateCcw, StopCircle, Layers } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { useAnalysis } from '../../hooks/useAnalysis';

export function RunButton() {
  const { state, dispatch } = useAppContext();
  const { runAnalysis, cancelBatch, status, batchProgress } = useAnalysis();

  const isFolder = state.uploadMode === 'folder';
  const hasInput = isFolder ? true : !!state.sonarFile;
  const isRunning = status === 'uploading' || status === 'processing';
  const canRun = hasInput && !isRunning;
  const isDone = status === 'complete';
  const isError = status === 'error';

  const handleReset = () => dispatch({ type: 'RESET' });

  // Progress calculations
  const currentSeq = batchProgress?.sequence ?? 0;
  const totalFrames = batchProgress?.total ?? (isFolder ? state.batchFiles.length : 1);
  const pct = totalFrames > 0 ? Math.min(100, Math.round((currentSeq / totalFrames) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Main Execution Button */}
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
          background: canRun ? '#0f172a' : '#f1f5f9',
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
        {/* Scanline sweep animation */}
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
              <span>
                {isFolder
                  ? `Processing ${currentSeq} / ${totalFrames}...`
                  : status === 'uploading'
                  ? 'Uploading Sonar...'
                  : 'Processing Pipeline...'}
              </span>
            </>
          ) : (
            <>
              {isFolder ? <Layers size={15} /> : <ScanLine size={15} />}
              <span>
                {isFolder
                  ? 'Start Mission'
                  : 'Analyze Sonar'}
              </span>
            </>
          )}
        </span>
      </button>

      {/* Live Batch Progress Bar & Cancel Control */}
      {isFolder && isRunning && (
        <div
          style={{
            padding: '10px 12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
              Processing {currentSeq} / {totalFrames}
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7' }}>
              {pct}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
            <span>Corridor: <strong style={{ color: '#0f172a' }}>{state.simulationRouteInfo?.name || 'Naval Patrol Route'}</strong></span>
            <span>Survey: <strong style={{ color: '#15803d' }}>Continuous Acoustic Scan</strong></span>
          </div>

          {/* Progress bar track */}
          <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7, #0ea5e9)',
                transition: 'width 250ms ease',
              }}
            />
          </div>

          {batchProgress?.currentFilename && (
            <div style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Current Frame: <strong>{batchProgress.currentFilename}</strong>
            </div>
          )}

          {/* Cancel Batch Button */}
          <button
            type="button"
            id="cancel-batch-btn"
            onClick={(e) => {
              e.stopPropagation();
              cancelBatch();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: 2,
            }}
          >
            <StopCircle size={13} />
            <span>Stop / Cancel Batch</span>
          </button>
        </div>
      )}

      {/* Completion Banner */}
      {isDone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <CheckCircle size={14} color="#15803d" />
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#15803d', flex: 1 }}>
            {isFolder && batchProgress
              ? `Batch ${batchProgress.status === 'cancelled' ? 'Cancelled' : 'Complete'}: ${batchProgress.processedCount} processed, ${batchProgress.failedCount} failed`
              : state.result
              ? `${state.result.detections.length} detections in ${state.result.processing_meta.processing_time_ms}ms`
              : 'Analysis Complete'}
          </span>
          <button onClick={handleReset} aria-label="Reset analysis" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d' }}>
            <RotateCcw size={13} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {isError && state.error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <AlertTriangle size={14} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#b91c1c' }}>{state.error}</span>
        </div>
      )}

      {!hasInput && (
        <p style={{ fontSize: '0.6875rem', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
          {isFolder ? 'Select a folder to start batch' : 'Load a sonar file to enable analysis'}
        </p>
      )}
    </div>
  );
}
