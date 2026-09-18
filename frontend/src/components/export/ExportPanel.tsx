// src/components/export/ExportPanel.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Download, FileJson, FileText, Archive, CheckCircle2, Layers, Camera, Crosshair } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { buildSurveyFrames } from '../../utils/spatialObservations';
import type { Detection, SurveyFrame } from '../../types/sonar';

const BACKEND_URL = 'http://localhost:8000';

function toDetectionGeoJSON(detections: Detection[]): string {
  const features = detections
    .filter((d) => d.geolocation)
    .map((d) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          d.mask_contour && d.mask_contour.length > 0
            ? d.mask_contour.map(([x, y]: [number, number]) => [
                d.geolocation!.lon + x / 10000,
                d.geolocation!.lat + y / 10000,
              ])
            : [
                [d.geolocation!.lon - 0.0001, d.geolocation!.lat - 0.0001],
                [d.geolocation!.lon + 0.0001, d.geolocation!.lat - 0.0001],
                [d.geolocation!.lon + 0.0001, d.geolocation!.lat + 0.0001],
                [d.geolocation!.lon - 0.0001, d.geolocation!.lat + 0.0001],
                [d.geolocation!.lon - 0.0001, d.geolocation!.lat - 0.0001],
              ],
        ],
      },
      properties: {
        id: d.id,
        target_class: d.target_class,
        confidence: d.confidence,
        hazard_risk: d.hazard_risk,
        shadow_evidence: d.shadow_evidence,
        expert_status: d.expert_status ?? 'UNVERIFIED',
        expert_verified: d.expert_verified ?? false,
        length_m: d.dimensions?.length_m ?? 0,
        width_m: d.dimensions?.width_m ?? 0,
        area_m2: d.dimensions?.area_m2 ?? 0,
        relief_height_m: d.dimensions?.relief_height_m ?? 0,
        latitude: d.geolocation!.lat,
        longitude: d.geolocation!.lon,
      },
    }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

function toDetectionCSV(detections: Detection[]): string {
  const header =
    'id,target_class,confidence_pct,hazard_risk,shadow_evidence,expert_status,expert_verified,length_m,width_m,area_m2,relief_height_m,latitude,longitude,local_x_m,local_y_m';
  const rows = detections.map((d) =>
    [
      d.id,
      d.target_class,
      (d.confidence * 100).toFixed(1),
      d.hazard_risk,
      d.shadow_evidence,
      d.expert_status ?? 'UNVERIFIED',
      d.expert_verified ? 'TRUE' : 'FALSE',
      d.dimensions?.length_m?.toFixed(2) ?? '0.00',
      d.dimensions?.width_m?.toFixed(2) ?? '0.00',
      d.dimensions?.area_m2?.toFixed(2) ?? '0.00',
      d.dimensions?.relief_height_m?.toFixed(2) ?? '0.00',
      d.geolocation?.lat?.toFixed(6) ?? '',
      d.geolocation?.lon?.toFixed(6) ?? '',
      d.local_offset?.x_m?.toFixed(2) ?? '',
      d.local_offset?.y_m?.toFixed(2) ?? '',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

function toFrameGeoJSON(frames: SurveyFrame[]): string {
  const features = frames
    .filter((f) => f.geolocation)
    .map((f) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [f.geolocation!.lon, f.geolocation!.lat],
      },
      properties: {
        id: f.id,
        filename: f.filename,
        sequence: f.sequence,
        timestamp: f.timestamp ?? '',
        status: f.status,
        anomaly_count: f.anomalyCount,
        highest_risk: f.highestRisk,
        highest_confidence: f.highestConfidence,
        expert_verified: f.expertVerified,
        verified_count: f.expertVerifiedCount,
        risk_summary: f.riskSummary,
        class_summary: f.classSummary,
        heat_weight: f.heatWeight,
      },
    }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

function toFrameCSV(frames: SurveyFrame[]): string {
  const header =
    'frame_id,filename,sequence,timestamp,latitude,longitude,anomaly_count,highest_risk,highest_confidence_pct,expert_verified,verified_anomaly_count,risk_critical,risk_high,risk_medium,risk_low,class_summary';
  const rows = frames.map((f) => {
    const classSummaryStr = Object.entries(f.classSummary)
      .map(([cls, cnt]) => `${cls}:${cnt}`)
      .join(';');
    return [
      `"${f.id}"`,
      `"${f.filename}"`,
      f.sequence,
      f.timestamp ? `"${f.timestamp}"` : '',
      f.geolocation?.lat?.toFixed(6) ?? '',
      f.geolocation?.lon?.toFixed(6) ?? '',
      f.anomalyCount,
      f.highestRisk,
      (f.highestConfidence * 100).toFixed(1),
      f.expertVerified ? 'TRUE' : 'FALSE',
      f.expertVerifiedCount,
      f.riskSummary.CRITICAL || 0,
      f.riskSummary.HIGH || 0,
      f.riskSummary.MEDIUM || 0,
      f.riskSummary.LOW || 0,
      `"${classSummaryStr}"`,
    ].join(',');
  });
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
  const [catalogType, setCatalogType] = useState<'detections' | 'frames'>('detections');
  const isBatch = state.uploadMode === 'folder';
  const batchDone = isBatch && state.batchDownloadUrls != null;

  const surveyFrames = useMemo(() => buildSurveyFrames(state), [state]);
  const allDetections = useMemo(() => {
    return surveyFrames.flatMap((f) => f.detections);
  }, [surveyFrames]);

  const hasData = catalogType === 'detections' ? allDetections.length > 0 : surveyFrames.length > 0;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const exportGeoJSON = useCallback(() => {
    if (catalogType === 'frames') {
      downloadBlob(toFrameGeoJSON(surveyFrames), `sonar_survey_frames_${ts}.geojson`, 'application/geo+json');
    } else {
      downloadBlob(toDetectionGeoJSON(allDetections), `sonar_detections_${ts}.geojson`, 'application/geo+json');
    }
  }, [catalogType, surveyFrames, allDetections, ts]);

  const exportCSV = useCallback(() => {
    if (catalogType === 'frames') {
      downloadBlob(toFrameCSV(surveyFrames), `sonar_survey_frames_${ts}.csv`, 'text/csv;charset=utf-8');
    } else {
      downloadBlob(toDetectionCSV(allDetections), `sonar_catalog_${ts}.csv`, 'text/csv;charset=utf-8');
    }
  }, [catalogType, surveyFrames, allDetections, ts]);

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
          <span
            style={{
              fontSize: '0.62rem',
              color: '#15803d',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <CheckCircle2 size={12} />
            <span>Ready</span>
          </span>
        )}
      </div>

      {/* Catalog Mode Toggle */}
      <div
        style={{
          display: 'flex',
          background: '#f1f5f9',
          borderRadius: 8,
          padding: 2,
          marginBottom: 10,
          gap: 2,
        }}
      >
        <button
          type="button"
          onClick={() => setCatalogType('detections')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '5px 8px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.68rem',
            fontWeight: catalogType === 'detections' ? 700 : 500,
            background: catalogType === 'detections' ? '#ffffff' : 'transparent',
            color: catalogType === 'detections' ? '#0f172a' : '#64748b',
            boxShadow: catalogType === 'detections' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <Crosshair size={12} />
          <span>Detections ({allDetections.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setCatalogType('frames')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '5px 8px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.68rem',
            fontWeight: catalogType === 'frames' ? 700 : 500,
            background: catalogType === 'frames' ? '#ffffff' : 'transparent',
            color: catalogType === 'frames' ? '#0f172a' : '#64748b',
            boxShadow: catalogType === 'frames' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <Camera size={12} />
          <span>Frames ({surveyFrames.length})</span>
        </button>
      </div>

      {/* BATCH DOWNLOADS */}
      {isBatch ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              id="download-batch-csv-btn"
              onClick={exportCSV}
              disabled={!hasData}
              aria-label={`Export ${catalogType === 'frames' ? 'Survey Frames' : 'Detections'} CSV`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${hasData ? '#0f172a' : '#e2e8f0'}`,
                background: hasData ? '#ffffff' : '#f8fafc',
                color: hasData ? '#0f172a' : '#94a3b8',
                cursor: hasData ? 'pointer' : 'not-allowed',
                fontSize: '0.72rem',
                fontWeight: 700,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                }
              }}
            >
              <FileText size={13} />
              <span>{catalogType === 'frames' ? 'Frames CSV' : 'Detections CSV'}</span>
            </button>

            <button
              id="download-batch-json-btn"
              onClick={exportGeoJSON}
              disabled={!hasData}
              aria-label={`Export ${catalogType === 'frames' ? 'Survey Frames' : 'Detections'} GeoJSON`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${hasData ? '#0f172a' : '#e2e8f0'}`,
                background: hasData ? '#ffffff' : '#f8fafc',
                color: hasData ? '#0f172a' : '#94a3b8',
                cursor: hasData ? 'pointer' : 'not-allowed',
                fontSize: '0.72rem',
                fontWeight: 700,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                }
              }}
            >
              <FileJson size={13} />
              <span>{catalogType === 'frames' ? 'Frames GeoJSON' : 'Detections GeoJSON'}</span>
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
              disabled={!hasData}
              aria-label={`Export ${catalogType === 'frames' ? 'Frames' : 'Detections'} GeoJSON`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                borderRadius: 20,
                border: `1px solid ${!hasData ? '#e2e8f0' : '#0f172a'}`,
                background: !hasData ? '#f8fafc' : '#ffffff',
                color: !hasData ? '#94a3b8' : '#0f172a',
                cursor: !hasData ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <FileJson size={14} />
              <span>{catalogType === 'frames' ? 'Frames GeoJSON' : 'GeoJSON'}</span>
            </button>

            <button
              id="export-csv-btn"
              onClick={exportCSV}
              disabled={!hasData}
              aria-label={`Export ${catalogType === 'frames' ? 'Frames' : 'Detections'} CSV`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                borderRadius: 20,
                border: `1px solid ${!hasData ? '#e2e8f0' : '#0f172a'}`,
                background: !hasData ? '#f8fafc' : '#ffffff',
                color: !hasData ? '#94a3b8' : '#0f172a',
                cursor: !hasData ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#0f172a';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasData) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <FileText size={14} />
              <span>{catalogType === 'frames' ? 'Frames CSV' : 'CSV'}</span>
            </button>
          </div>

          {!hasData && (
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
              Run analysis to enable deliverables
            </p>
          )}
        </div>
      )}
    </div>
  );
}

