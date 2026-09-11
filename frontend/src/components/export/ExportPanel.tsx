// src/components/export/ExportPanel.tsx
import React, { useCallback } from 'react';
import { Download, FileJson, FileText } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import type { Detection } from '../../types/sonar';

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
  const detections = state.result?.detections;
  const disabled = !detections || detections.length === 0;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const exportGeoJSON = useCallback(() => {
    if (!detections) return;
    downloadBlob(toGeoJSON(detections), `sonar_detections_${ts}.geojson`, 'application/geo+json');
  }, [detections, ts]);

  const exportCSV = useCallback(() => {
    if (!detections) return;
    downloadBlob(toCSV(detections), `sonar_catalog_${ts}.csv`, 'text/csv;charset=utf-8');
  }, [detections, ts]);

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
        }}
      >
        Export Deliverables
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          id="export-geojson-btn"
          onClick={exportGeoJSON}
          disabled={disabled}
          aria-label="Export GeoJSON"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 12px',
            borderRadius: 20,
            border: `1px solid ${disabled ? '#e2e8f0' : '#0f172a'}`,
            background: disabled ? '#f8fafc' : '#ffffff',
            color: disabled ? '#94a3b8' : '#0f172a',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
            transition: 'all 180ms ease',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = '#0f172a';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
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
          onClick={exportCSV}
          disabled={disabled}
          aria-label="Export CSV catalog"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 12px',
            borderRadius: 20,
            border: `1px solid ${disabled ? '#e2e8f0' : '#0f172a'}`,
            background: disabled ? '#f8fafc' : '#ffffff',
            color: disabled ? '#94a3b8' : '#0f172a',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
            transition: 'all 180ms ease',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = '#0f172a';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
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

      {disabled && (
        <p style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
          Run analysis to enable deliverables
        </p>
      )}
    </div>
  );
}
