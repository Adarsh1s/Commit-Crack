// src/components/layout/AppShell.tsx
// Three-column layout with dynamic draggable resize handles and one-click maximize/restore.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { MissionMap } from '../map/MissionMap';
import { SonarImageViewer } from '../map/SonarImageViewer';
import { useAppContext } from '../../store/AppContext';

export const MIN_LEFT_WIDTH = 260;
export const MIN_RIGHT_WIDTH = 280;
export const MIN_MAP_WIDTH = 240;
export const DEFAULT_LEFT = 320;
export const DEFAULT_RIGHT = 360;

interface DragState {
  side: 'left' | 'right';
  startX: number;
  startWidth: number;
  windowWidth: number;
}

export function AppShell() {
  const { state } = useAppContext();
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [isLeftMaximized, setIsLeftMaximized] = useState(false);
  const [isRightMaximized, setIsRightMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // 'map' | 'sonar' — auto-switch to sonar when analysis completes
  const [centerView, setCenterView] = useState<'map' | 'sonar'>('map');

  // Auto-switch to sonar viewer in single mode, but keep map view in folder batch mode
  useEffect(() => {
    if (state.uploadMode === 'folder') {
      setCenterView('map');
    } else if (state.result && state.uploadMode === 'single') {
      setCenterView('sonar');
    }
  }, [state.result, state.uploadMode]);

  const prevLeftWidth = useRef(DEFAULT_LEFT);
  const prevRightWidth = useRef(DEFAULT_RIGHT);
  const dragRef = useRef<DragState | null>(null);

  // Keep panels clamped within screen bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      const W = window.innerWidth;
      setLeftWidth((cur) => {
        const maxL = Math.max(MIN_LEFT_WIDTH, W - rightWidth - MIN_MAP_WIDTH - 20);
        return Math.min(cur, maxL);
      });
      setRightWidth((cur) => {
        const maxR = Math.max(MIN_RIGHT_WIDTH, W - leftWidth - MIN_MAP_WIDTH - 20);
        return Math.min(cur, maxR);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [leftWidth, rightWidth]);

  // Toggle Left Maximize
  const toggleLeftMaximize = useCallback(() => {
    const W = window.innerWidth;
    if (isLeftMaximized) {
      setLeftWidth(prevLeftWidth.current || DEFAULT_LEFT);
      setIsLeftMaximized(false);
    } else {
      prevLeftWidth.current = leftWidth;
      // Shrink right panel if needed to give room
      const safeRight = Math.min(rightWidth, Math.max(MIN_RIGHT_WIDTH, Math.floor(W * 0.25)));
      setRightWidth(safeRight);

      // Maximize left up to 65% of screen, leaving safe room for map and right panel
      const maxAvailable = W - safeRight - MIN_MAP_WIDTH - 24;
      const targetWidth = Math.min(Math.floor(W * 0.65), Math.max(MIN_LEFT_WIDTH, maxAvailable));
      setLeftWidth(targetWidth);
      setIsLeftMaximized(true);
      setIsRightMaximized(false);
    }
  }, [isLeftMaximized, leftWidth, rightWidth]);

  // Toggle Right Maximize
  const toggleRightMaximize = useCallback(() => {
    const W = window.innerWidth;
    if (isRightMaximized) {
      setRightWidth(prevRightWidth.current || DEFAULT_RIGHT);
      setIsRightMaximized(false);
    } else {
      prevRightWidth.current = rightWidth;
      // Shrink left panel if needed to give room
      const safeLeft = Math.min(leftWidth, Math.max(MIN_LEFT_WIDTH, Math.floor(W * 0.22)));
      setLeftWidth(safeLeft);

      // Maximize right up to 70% of screen, leaving safe room for map and left panel
      const maxAvailable = W - safeLeft - MIN_MAP_WIDTH - 24;
      const targetWidth = Math.min(Math.floor(W * 0.70), Math.max(MIN_RIGHT_WIDTH, maxAvailable));
      setRightWidth(targetWidth);
      setIsRightMaximized(true);
      setIsLeftMaximized(false);
    }
  }, [isRightMaximized, rightWidth, leftWidth]);

  // Pointer drag resizing with strict bounds
  const startDrag = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    dragRef.current = {
      side,
      startX: e.clientX,
      startWidth: side === 'left' ? leftWidth : rightWidth,
      windowWidth: window.innerWidth,
    };

    const onMove = (me: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const W = window.innerWidth;
      const delta = me.clientX - d.startX;

      if (d.side === 'left') {
        // Left panel cannot push past (W - currentRight - MIN_MAP_WIDTH)
        const maxLeft = Math.max(MIN_LEFT_WIDTH, W - rightWidth - MIN_MAP_WIDTH - 20);
        const next = Math.min(maxLeft, Math.max(MIN_LEFT_WIDTH, d.startWidth + delta));
        setLeftWidth(next);
        setIsLeftMaximized(next > Math.floor(W * 0.5));
      } else {
        // Right panel cannot push past (W - currentLeft - MIN_MAP_WIDTH)
        const maxRight = Math.max(MIN_RIGHT_WIDTH, W - leftWidth - MIN_MAP_WIDTH - 20);
        const next = Math.min(maxRight, Math.max(MIN_RIGHT_WIDTH, d.startWidth - delta));
        setRightWidth(next);
        setIsRightMaximized(next > Math.floor(W * 0.5));
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftWidth, rightWidth]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        overflow: 'hidden',
        animation: 'fadeIn 0.5s ease',
        background: '#F7F8F4',
      }}
    >
      <TopBar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          maxWidth: '100vw',
        }}
      >
        {/* Left Panel: MISSION CONTROLS */}
        <LeftPanel
          width={leftWidth}
          isMaximized={isLeftMaximized}
          onToggleMaximize={toggleLeftMaximize}
          isDragging={isDragging}
        />

        {/* Left resize handle */}
        <div
          onMouseDown={(e) => startDrag('left', e)}
          onDoubleClick={toggleLeftMaximize}
          title="Drag to resize Mission Controls · Double-click to maximize / restore"
          style={{
            width: 6,
            flexShrink: 0,
            background: isDragging ? '#cbd5e1' : '#f1f5f9',
            cursor: 'ew-resize',
            position: 'relative',
            zIndex: 30,
            transition: 'background 150ms ease',
            borderLeft: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
          onMouseLeave={(e) => {
            if (!isDragging) (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
          }}
        >
          {/* Visual grip */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            display: 'flex', flexDirection: 'column', gap: 4,
            pointerEvents: 'none',
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: 3,
                  background: '#94a3b8',
                  borderRadius: '1px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Center panel — sonar image viewer OR hydrographic map */}
        <main
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            minWidth: 0,
            background: '#ffffff',
          }}
        >
          {centerView === 'sonar' && state.result ? (
            <SonarImageViewer onSwitchToMap={() => setCenterView('map')} />
          ) : (
            <>
              <MissionMap />
              {/* Map→Sonar toggle (only shown when results exist) */}
              {state.result && (
                <button
                  onClick={() => setCenterView('sonar')}
                  style={{
                    position: 'absolute', top: 14, left: 14, zIndex: 500,
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 20,
                    background: '#0f172a', border: 'none',
                    color: '#ffffff', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 700,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                  }}
                >
                  📡 View Sonar Image
                </button>
              )}
            </>
          )}
        </main>

        {/* Right resize handle */}
        <div
          onMouseDown={(e) => startDrag('right', e)}
          onDoubleClick={toggleRightMaximize}
          title="Drag to resize Mission Results · Double-click to maximize / restore"
          style={{
            width: 6,
            flexShrink: 0,
            background: isDragging ? '#cbd5e1' : '#f1f5f9',
            cursor: 'ew-resize',
            position: 'relative',
            zIndex: 30,
            transition: 'background 150ms ease',
            borderLeft: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
          onMouseLeave={(e) => {
            if (!isDragging) (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
          }}
        >
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            display: 'flex', flexDirection: 'column', gap: 4,
            pointerEvents: 'none',
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: 3,
                  background: '#94a3b8',
                  borderRadius: '1px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Right Panel: MISSION RESULTS */}
        <RightPanel
          width={rightWidth}
          isMaximized={isRightMaximized}
          onToggleMaximize={toggleRightMaximize}
          isDragging={isDragging}
        />
      </div>
    </div>
  );
}
