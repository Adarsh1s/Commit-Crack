// src/components/upload/SonarDropzone.tsx
import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileImage, X, Eye, Sparkles } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { formatFileSize } from '../../utils/formatters';

const ACCEPTED = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif', '.pbm'];
const ACCEPTED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/x-portable-bitmap',
];

export function SonarDropzone() {
  const { state, dispatch } = useAppContext();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    dispatch({ type: 'SET_SONAR_FILE', payload: file });
    if (file.type.startsWith('image/') && file.type !== 'image/tiff') {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, [dispatch]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearFile = useCallback(() => {
    dispatch({ type: 'CLEAR_SONAR_FILE' });
    if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
    if (inputRef.current) inputRef.current.value = '';
  }, [dispatch, preview]);

  const SAMPLE_PRESETS = [
    { name: 'Pipeline Survey', path: '/samples/pipeline_survey.jpg', desc: 'Subsea Pipeline' },
    { name: 'Mine Cylinder', path: '/samples/mine_cylinder_tile.png', desc: 'Cylinder Contact' },
    { name: 'Ghost Gear', path: '/samples/sonar_sample_07600.jpg', desc: 'Derelict Fishing Net' },
    { name: 'Shipwreck Anomaly', path: '/samples/shipwreck_anomaly.png', desc: 'Seabed Anomaly' },
  ];

  // One-click loader for sample sonar images
  const loadPresetSonar = useCallback(async (samplePath: string, sampleName: string) => {
    setLoadingSample(true);
    try {
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const ext = samplePath.endsWith('.png') ? 'png' : 'jpg';
      const file = new File([blob], sampleName, { type: ext === 'png' ? 'image/png' : 'image/jpeg' });
      handleFile(file);
    } catch (err) {
      console.error('Failed to load sample sonar:', err);
    } finally {
      setLoadingSample(false);
    }
  }, [handleFile]);

  return (
    <div>
      <div
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#64748b',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Primary Sonar Image</span>
          <span style={{ color: '#ef4444' }}>*</span>
        </div>
      </div>

      {/* Preset Sonar Survey Chips */}
      {!state.sonarFile && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={11} color="#0284c7" />
            <span>QUICK PRESETS (CLICK TO LOAD)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => loadPresetSonar(preset.path, `${preset.name.toLowerCase().replace(/\\s+/g, '_')}.jpg`)}
                disabled={loadingSample}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '6px 8px',
                  cursor: loadingSample ? 'wait' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0f172a';
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.background = '#ffffff';
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a' }}>
                  {preset.name}
                </div>
                <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: 1 }}>
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.sonarFile ? (
        <div
          style={{
            padding: 12,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {preview ? (
              <img src={preview} alt="sonar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <FileImage size={24} color="#64748b" />
            )}
          </div>

          {/* File info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state.sonarFile.name}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
              {formatFileSize(state.sonarFile.size)}
            </div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 8px',
                borderRadius: 10,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '0.62rem',
                fontWeight: 600,
              }}
            >
              Ready for Analysis
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {preview && (
              <button onClick={() => window.open(preview!, '_blank')} aria-label="Preview sonar file" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                <Eye size={15} />
              </button>
            )}
            <button onClick={clearFile} aria-label="Remove sonar file" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
              <X size={15} />
            </button>
          </div>
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
          aria-label="Drop sonar image file or click to browse"
          style={{
            borderRadius: 14,
            border: `1.5px dashed ${dragOver ? '#0f172a' : '#cbd5e1'}`,
            background: dragOver ? '#f1f5f9' : '#ffffff',
            padding: '20px 14px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 180ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
            }}>
              <Upload size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                {dragOver ? 'Release to upload' : 'Drop sonar image here'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                or <span style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'underline' }}>browse files</span>
              </div>
            </div>
            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
              {ACCEPTED.join(' · ')}
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        style={{ display: 'none' }}
        onChange={onInputChange}
        aria-hidden="true"
      />
    </div>
  );
}

