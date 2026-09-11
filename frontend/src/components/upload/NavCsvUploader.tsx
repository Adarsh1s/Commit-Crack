// src/components/upload/NavCsvUploader.tsx
import React, { useCallback, useRef, useState } from 'react';
import { FileText, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { formatFileSize } from '../../utils/formatters';

const REQUIRED_COLS = ['timestamp', 'latitude', 'longitude', 'altitude_m', 'heading_deg', 'speed_knots'];

function validateCsvHeaders(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const firstLine = text.split('\n')[0] ?? '';
      const headers = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
      const missing = REQUIRED_COLS.filter((col) => !headers.includes(col));
      resolve(missing);
    };
    reader.readAsText(file.slice(0, 2048));
  });
}

export function NavCsvUploader() {
  const { state, dispatch } = useAppContext();
  const [dragOver, setDragOver] = useState(false);
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) return;
    dispatch({ type: 'SET_NAV_FILE', payload: file });
    const missing = await validateCsvHeaders(file);
    setMissingCols(missing);
  }, [dispatch]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearFile = useCallback(() => {
    dispatch({ type: 'SET_NAV_FILE', payload: null });
    setMissingCols([]);
    if (inputRef.current) inputRef.current.value = '';
  }, [dispatch]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Navigation Telemetry
        </span>
        <span style={{ fontSize: '0.6rem', color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 10 }}>
          Optional
        </span>
      </div>

      {state.navCsvFile ? (
        <div>
          <div
            style={{
              padding: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
            }}
          >
            <FileText size={16} color="#0f172a" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {state.navCsvFile.name}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                {formatFileSize(state.navCsvFile.size)}
              </div>
            </div>
            {missingCols.length === 0
              ? <CheckCircle size={14} color="#10b981" />
              : <AlertTriangle size={14} color="#f59e0b" />
            }
            <button onClick={clearFile} aria-label="Remove nav CSV" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
          {missingCols.length > 0 && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, fontSize: '0.6875rem', color: '#b45309', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Missing columns: <span>{missingCols.join(', ')}</span></span>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Drop navigation CSV file or click to browse"
          style={{
            padding: 12,
            borderRadius: 12,
            border: `1px dashed ${dragOver ? '#0f172a' : '#cbd5e1'}`,
            background: dragOver ? '#f1f5f9' : '#ffffff',
            cursor: 'pointer',
            transition: 'all 180ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
            <FileText size={18} color="#0f172a" style={{ flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>Drop nav CSV or click to browse</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 1 }}>
                timestamp · latitude · longitude · speed_knots
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        aria-hidden="true"
      />
    </div>
  );
}
