// src/components/export/ExportPanel.tsx
import React, { useCallback } from 'react';
import { Download, FileJson, FileText, Archive, CheckCircle2, Layers } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import type { Detection } from '../../types/sonar';

const BACKEND_URL = 'http://localhost:8000';

function toGeoJSON(detections: Detection[]): string {
  const features = detections
    .filter((d) => d.geolocation)
    .map((d) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [d.mask_contour.map(([x, y]: [number, number]) => [
          d.geolocation!.lon + (x / 10000),
          d.geolocation!.lat + (y / 10000),
        ])],
      },
      properties: {
        id: d.id,
        target_class: d.target_class,
        confidence: d.confidence,
        hazard_risk: d.hazard_risk,
        shadow_evidence: d.shadow_evidence,
        length_m: d.dimensions.length_m,
        width_m: d.dimensions.width_m,
        area_m2: d.dimensions.area_m2,
        relief_height_m: d.dimensions.relief_height_m,
        latitude: d.geolocation!.lat,
        longitude: d.geolocation!.lon,
      },
    }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

function toCSV(detections: Detection[]): string {
  const header = 'id,target_class,confidence_pct,hazard_risk,shadow_evidence,length_m,width_m,area_m2,relief_height_m,latitude,longitude,local_x_m,local_y_m';
  const rows = detections.map((d) => [
    d.id,
    d.target_class,
    (d.confidence * 100).toFixed(1),
    d.hazard_risk,
    d.shadow_evidence,
    d.dimensions.length_m.toFixed(2),
    d.dimensions.width_m.toFixed(2),
    d.dimensions.area_m2.toFixed(2),
    d.dimensions.relief_height_m.toFixed(2),
    d.geolocation?.lat.toFixed(6) ?? '',
    d.geolocation?.lon.toFixed(6) ?? '',
    d.local_offset?.x_m.toFixed(2) ?? '',
    d.local_offset?.y_m.toFixed(2) ?? '',
  ].join(','));
  return [header, ...rows].join('\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel() {
  const { state } = useAppContext();
  const isBatch = state.uploadMode === 'folder';
  const batchDone = isBatch && state.batchDownloadUrls != null;
  const detections = state.result?.detections;
  const singleDisabled = !detections || detections.length === 0;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const exportGeoJSON = useCallback(() => {
    if (!detections) return;
    downloadBlob(toGeoJSON(detections), `sonar_detections_${ts}.geojson`, 'application/geo+json');
  }, [detections, ts]);

  const exportSingleCSV = useCallback(() => {
    if (!detections) return;
    downloadBlob(toCSV(detections), `sonar_catalog_${ts}.csv`, 'text/csv;charset=utf-8');
  }, [detections, ts]);

  // Batch download handlers
  const downloadBatchCSV = useCallback(() => {
    if (!state.batchId) return;
    window.open(`${BACKEND_URL}/api/v1/batch/${state.batchId}/download/csv`, '_blank');
  }, [state.batchId]);

  const downloadBatchJSON = useCallback(() => {
    if (!state.batchId) return;
    window.open(`${BACKEND_URL}/api/v1/batch/${state.batchId}/download/json`, '_blank');
  }, [state.batchId]);

  const downloadBatchZIP = useCallback(() => {
    if (!state.batchId) return;
    window.open(`${BACKEND_URL}/api/v1/batch/${state.batchId}/download/zip`, '_blank');
  }, [state.batchId]);

  return (
    <div>
      <div
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#64748b',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{isBatch ? 'Batch Mission Deliverables' : 'Export Deliverables'}</span>
        {isBatch && batchDone && (
          <span style={{ fontSize: '0.62rem', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
            <CheckCircle2 size={12} />
            <span>Ready</span>
          </span>
        )}
      </div>

      {/* BATCH DOWNLOADS */}
      {isBatch ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              id="download-batch-csv-btn"
              onClick={downloadBatchCSV}
              disabled={!batchDone}
              aria-label="Download Batch CSV"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${batchDone ? '#0f172a' : '#e2e8f0'}`,
                background: batchDone ? '#ffffff' : '#f8fafc',
                color: batchDone ? '#0f172a' : '#94a3b8',
                cursor: batchDone ? 'pointer' : 'not-allowed',
                fontSize: '0.72rem',
                fontWeight: 700,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (batchDone) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (batchDone) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                }
              }}
            >
              <FileText size={13} />
              <span>Batch CSV</span>
            </button>

            <button
              id="download-batch-json-btn"
              onClick={downloadBatchJSON}
              disabled={!batchDone}
              aria-label="Download Batch JSON"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${batchDone ? '#0f172a' : '#e2e8f0'}`,
                background: batchDone ? '#ffffff' : '#f8fafc',
                color: batchDone ? '#0f172a' : '#94a3b8',
                cursor: batchDone ? 'pointer' : 'not-allowed',
                fontSize: '0.72rem',
                fontWeight: 700,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (batchDone) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (batchDone) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                }
              }}
            >
              <FileJson size={13} />
              <span>Batch JSON</span>
            </button>
          </div>

          {/* Full Archive ZIP Button */}
          <button
            id="download-batch-zip-btn"
            onClick={downloadBatchZIP}
            disabled={!batchDone}
            aria-label="Download Complete Batch ZIP"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: batchDone ? '#0284c7' : '#f1f5f9',
              color: batchDone ? '#ffffff' : '#94a3b8',
              cursor: batchDone ? 'pointer' : 'not-allowed',
              fontSize: '0.75rem',
              fontWeight: 700,
              boxShadow: batchDone ? '0 2px 8px rgba(2, 132, 199, 0.25)' : 'none',
              transition: 'all 180ms ease',
            }}
            onMouseEnter={(e) => {
              if (batchDone) {
                e.currentTarget.style.background = '#0369a1';
              }
            }}
            onMouseLeave={(e) => {
              if (batchDone) {
                e.currentTarget.style.background = '#0284c7';
              }
            }}
          >
            <Archive size={14} />
            <span>Download Complete Batch (.ZIP)</span>
          </button>

          {!batchDone && (
            <p style={{ fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center', margin: '4px 0 0' }}>
              Run batch survey to generate deliverable archive
            </p>
          )}
        </div>
      ) : (
        /* SINGLE IMAGE EXPORT BUTTONS */
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              id="export-geojson-btn"
              onClick={exportGeoJSON}
              disabled={singleDisabled}
              aria-label="Export GeoJSON"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                borderRadius: 20,
                border: `1px solid ${singleDisabled ? '#e2e8f0' : '#0f172a'}`,
                background: singleDisabled ? '#f8fafc' : '#ffffff',
                color: singleDisabled ? '#94a3b8' : '#0f172a',
                cursor: singleDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => {
                if (!singleDisabled) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!singleDisabled) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <FileJson size={14} />
              <span>GeoJSON</span>
            </button>

            <button
              id="export-csv-btn"
              onClick={exportSingleCSV}
              disabled={singleDisabled}
              aria-label="Export CSV catalog"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                borderRadius: 20,
                border: `1px solid ${singleDisabled ? '#e2e8f0' : '#0f172a'}`,
                background: singleDisabled ? '#f8fafc' : '#ffffff',
                color: singleDisabled ? '#94a3b8' : '#0f172a',
                cursor: singleDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => {
                if (!singleDisabled) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!singleDisabled) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <FileText size={14} />
              <span>CSV</span>
            </button>
          </div>

          {singleDisabled && (
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
              Run analysis to enable deliverables
            </p>
          )}
        </div>
      )}
    </div>
  );
}
