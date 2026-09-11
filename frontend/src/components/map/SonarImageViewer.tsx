// src/components/map/SonarImageViewer.tsx
// Displays the annotated sonar image (with bounding boxes) returned by the backend.
// Overlays detection bounding boxes as interactive SVG on top of the image.
// Clicking a box selects the detection and opens the TargetDrawer.

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Layers, Map } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { RISK_COLORS } from '../../utils/colorScale';

const CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  ghost_gear: 'Ghost Gear',
  mine_cylinder: 'Mine / Cylinder',
  debris_anomaly: 'Debris Anomaly',
};

interface Props {
  onSwitchToMap: () => void;
}

export function SonarImageViewer({ onSwitchToMap }: Props) {
  const { state, dispatch } = useAppContext();
  const result = state.result;
  const [zoom, setZoom] = useState(1);
  const [showAnnotated, setShowAnnotated] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const imageUrl = showAnnotated ? result?.enhanced_image_url : result?.raw_image_url;
  const detections = result?.detections ?? [];

  // Measure rendered image size for SVG overlay scaling
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const update = () => setImgSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageUrl]);

  const handleZoomIn = () => setZoom((z) => Math.min(4, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));
  const handleReset = () => setZoom(1);

  if (!result) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0a0f1a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 40,
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>
          SONAR ANALYSIS
        </span>
        <span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 4 }}>
          {detections.length} detection{detections.length !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Toggle raw/annotated */}
        <button
          onClick={() => setShowAnnotated((v) => !v)}
          title={showAnnotated ? 'Show raw image' : 'Show annotated image'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6,
            background: showAnnotated ? '#1e3a5f' : '#1e293b',
            border: `1px solid ${showAnnotated ? '#2563eb' : '#334155'}`,
            color: showAnnotated ? '#60a5fa' : '#64748b',
            cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
          }}
        >
          <Layers size={12} />
          {showAnnotated ? 'Annotated' : 'Raw'}
        </button>

        {/* Zoom controls */}
        {[
          { icon: ZoomOut, action: handleZoomOut, label: 'Zoom out' },
          { icon: RotateCcw, action: handleReset, label: 'Reset zoom' },
          { icon: ZoomIn, action: handleZoomIn, label: 'Zoom in' },
        ].map(({ icon: Icon, action, label }) => (
          <button
            key={label}
            onClick={action}
            title={label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              background: '#1e293b', border: '1px solid #334155',
              color: '#94a3b8', cursor: 'pointer',
            }}
          >
            <Icon size={13} />
          </button>
        ))}

        <span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 2 }}>
          {Math.round(zoom * 100)}%
        </span>

        {/* Switch to map button */}
        <button
          onClick={onSwitchToMap}
          title="Switch to map view"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6, marginLeft: 6,
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
          }}
        >
          <Map size={12} />
          Map
        </button>
      </div>

      {/* ── Image + SVG overlay ──────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 16,
          background: '#060c14',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 200ms ease',
          }}
        >
          {/* Sonar image */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Sonar analysis result"
            draggable={false}
            style={{
              display: 'block',
              maxWidth: '100%',
              borderRadius: 4,
              boxShadow: '0 0 40px rgba(0, 120, 200, 0.15)',
              border: '1px solid #1e3a5f',
            }}
            onLoad={() => {
              const el = imgRef.current;
              if (el) setImgSize({ w: el.offsetWidth, h: el.offsetHeight });
            }}
          />

          {/* SVG bounding box overlay — only shown on raw view, since annotated
              already has boxes drawn. This gives interactive hit areas. */}
          {imgSize && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: imgSize.w,
                height: imgSize.h,
                pointerEvents: 'none',
              }}
              viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
            >
              {detections.map((det) => {
                const [bx1, by1, bx2, by2] = det.bounding_box;
                // We don't know original image dims, use bounding_box as is
                // Scale from any assumed original size to current rendered size
                // The backend image and rendered img share the same aspect ratio
                const imgEl = imgRef.current;
                if (!imgEl || !imgEl.naturalWidth) return null;
                const scaleX = imgSize.w / imgEl.naturalWidth;
                const scaleY = imgSize.h / imgEl.naturalHeight;
                const rx = bx1 * scaleX;
                const ry = by1 * scaleY;
                const rw = (bx2 - bx1) * scaleX;
                const rh = (by2 - by1) * scaleY;
                const riskColor = RISK_COLORS[det.hazard_risk];
                const isSelected = state.selectedDetectionId === det.id;

                return (
                  <g
                    key={det.id}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() =>
                      dispatch({ type: 'SELECT_DETECTION', payload: isSelected ? null : det.id })
                    }
                  >
                    {/* Invisible hit area */}
                    <rect
                      x={rx} y={ry} width={rw} height={rh}
                      fill="transparent"
                      stroke={isSelected ? riskColor : 'transparent'}
                      strokeWidth={isSelected ? 2.5 : 0}
                      strokeDasharray={isSelected ? '5 3' : undefined}
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* ── Bottom legend strip ──────────────────────────────────────────────── */}
      {detections.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #1e293b',
            background: '#0f172a',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', flexShrink: 0 }}>
            DETECTIONS
          </span>
          {detections.map((det, i) => (
            <button
              key={det.id}
              onClick={() =>
                dispatch({ type: 'SELECT_DETECTION', payload: state.selectedDetectionId === det.id ? null : det.id })
              }
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 12, flexShrink: 0,
                background: state.selectedDetectionId === det.id ? '#1e3a5f' : 'transparent',
                border: `1px solid ${state.selectedDetectionId === det.id ? RISK_COLORS[det.hazard_risk] : '#1e293b'}`,
                color: RISK_COLORS[det.hazard_risk],
                cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: RISK_COLORS[det.hazard_risk],
                  flexShrink: 0,
                }}
              />
              {`#${i + 1} ${CLASS_LABELS[det.target_class] ?? det.target_class}`}
              <span style={{ color: '#475569', fontWeight: 500 }}>
                {(det.confidence * 100).toFixed(0)}%
              </span>
            </button>
          ))}

          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.6rem', color: '#334155', flexShrink: 0 }}>
            {result?.processing_meta.processing_time_ms}ms
          </span>
        </div>
      )}
    </div>
  );
}
