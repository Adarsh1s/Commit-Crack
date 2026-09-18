// src/components/upload/SonarDropzone.tsx
import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileImage, Folder, X, Eye, Sparkles, Layers, FileCode } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';
import { formatFileSize } from '../../utils/formatters';
import type { UploadMode } from '../../types/sonar';

const ACCEPTED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif', '.pbm'];

function isValidSonarFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTS.includes(ext) || file.type.startsWith('image/');
}

async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = dataTransfer.items;

  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const queue: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) queue.push(entry);
    }

    const readEntry = async (entry: any): Promise<void> => {
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file((file: File) => {
            if (isValidSonarFile(file)) files.push(file);
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries: any[] = await new Promise((resolve) => {
          dirReader.readEntries((results: any[]) => resolve(results || []), () => resolve([]));
        });
        for (const child of entries) {
          await readEntry(child);
        }
      }
    };

    while (queue.length > 0) {
      const current = queue.shift();
      await readEntry(current);
    }
  } else {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const f = dataTransfer.files[i];
      if (isValidSonarFile(f)) files.push(f);
    }
  }

  return files;
}

export function SonarDropzone() {
  const { state, dispatch } = useAppContext();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const setMode = (mode: UploadMode) => {
    dispatch({ type: 'SET_UPLOAD_MODE', payload: mode });
  };

  const handleSingleFile = useCallback((file: File) => {
    dispatch({ type: 'SET_SONAR_FILE', payload: file });
    if (file.type.startsWith('image/') && file.type !== 'image/tiff') {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, [dispatch]);

  const handleFolderFiles = useCallback((files: File[]) => {
    const valid = files.filter(isValidSonarFile);
    if (valid.length > 0) {
      dispatch({ type: 'SET_BATCH_FILES', payload: valid });
    }
  }, [dispatch]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (state.uploadMode === 'single') {
      const file = e.dataTransfer.files[0];
      if (file && isValidSonarFile(file)) handleSingleFile(file);
    } else {
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) handleFolderFiles(files);
    }
  }, [state.uploadMode, handleSingleFile, handleFolderFiles]);

  const onSingleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidSonarFile(file)) handleSingleFile(file);
  }, [handleSingleFile]);

  const onFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      handleFolderFiles(fileList);
    }
  }, [handleFolderFiles]);

  const clearSingle = useCallback(() => {
    dispatch({ type: 'CLEAR_SONAR_FILE' });
    if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
    if (singleInputRef.current) singleInputRef.current.value = '';
  }, [dispatch, preview]);

  const clearFolder = useCallback(() => {
    dispatch({ type: 'CLEAR_BATCH_FILES' });
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [dispatch]);

  const SAMPLE_PRESETS = [
    { name: 'Pipeline Survey', path: '/samples/pipeline_survey.jpg', desc: 'Subsea Pipeline' },
    { name: 'Mine Cylinder', path: '/samples/mine_cylinder_tile.png', desc: 'Cylinder Contact' },
    { name: 'Ghost Gear', path: '/samples/sonar_sample_07600.jpg', desc: 'Derelict Fishing Net' },
    { name: 'Shipwreck Anomaly', path: '/samples/shipwreck_anomaly.png', desc: 'Seabed Anomaly' },
  ];

  const loadPresetSonar = useCallback(async (samplePath: string, sampleName: string) => {
    setLoadingSample(true);
    try {
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const ext = samplePath.endsWith('.png') ? 'png' : 'jpg';
      const file = new File([blob], sampleName, { type: ext === 'png' ? 'image/png' : 'image/jpeg' });
      handleSingleFile(file);
    } catch (err) {
      console.error('Failed to load sample sonar:', err);
    } finally {
      setLoadingSample(false);
    }
  }, [handleSingleFile]);

  return (
    <div>
      {/* Header & Mode Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Primary Sonar Ingestion
          </span>
          <span style={{ color: '#ef4444' }}>*</span>
        </div>

        {/* Segmented Mode Switcher */}
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            borderRadius: 8,
            padding: 2,
            border: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('single')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              border: 'none',
              background: state.uploadMode === 'single' ? '#ffffff' : 'transparent',
              color: state.uploadMode === 'single' ? '#0f172a' : '#64748b',
              fontSize: '0.65rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: state.uploadMode === 'single' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            <FileImage size={11} />
            <span>Single</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('folder')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              border: 'none',
              background: state.uploadMode === 'folder' ? '#ffffff' : 'transparent',
              color: state.uploadMode === 'folder' ? '#0f172a' : '#64748b',
              fontSize: '0.65rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: state.uploadMode === 'folder' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            <Folder size={11} />
            <span>Folder Batch</span>
          </button>
        </div>
      </div>

      {/* SINGLE IMAGE MODE */}
      {state.uploadMode === 'single' && (
        <>
          {/* Quick Presets */}
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
                    onClick={() => loadPresetSonar(preset.path, `${preset.name.toLowerCase().replace(/\s+/g, '_')}.jpg`)}
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

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {state.sonarFile.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                  {formatFileSize(state.sonarFile.size)} · Single Image
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
                  Ready for Evaluation
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {preview && (
                  <button onClick={() => window.open(preview!, '_blank')} aria-label="Preview sonar file" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                    <Eye size={15} />
                  </button>
                )}
                <button onClick={clearSingle} aria-label="Remove sonar file" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                  <X size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => singleInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && singleInputRef.current?.click()}
              aria-label="Drop single sonar image file or click to browse"
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
                    {dragOver ? 'Release to upload image' : 'Drop Single Sonar Image'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    or <span style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'underline' }}>browse file</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                  {ACCEPTED_EXTS.join(' · ')}
                </div>
              </div>
            </div>
          )}

          <input
            ref={singleInputRef}
            type="file"
            accept={ACCEPTED_EXTS.join(',')}
            style={{ display: 'none' }}
            onChange={onSingleInputChange}
            aria-hidden="true"
          />
        </>
      )}

      {/* FOLDER BATCH MODE */}
      {state.uploadMode === 'folder' && (
        <>
          {state.batchFiles.length > 0 ? (
            <div
              style={{
                padding: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#0f172a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Folder size={22} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                    Folder Survey Batch
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>
                    <strong style={{ color: '#0284c7' }}>{state.batchFiles.length}</strong> valid sonar frames detected
                  </div>
                </div>

                <button
                  onClick={clearFolder}
                  aria-label="Remove batch files"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>



              {/* Arabian Sea Route notice */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.65rem',
                  color: '#15803d',
                  fontWeight: 600,
                }}
              >
                <span>⚓ Arabian Sea Submarine Route: Mumbai → Kochi (Synchronized across {state.batchFiles.length} frames)</span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => folderInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && folderInputRef.current?.click()}
              aria-label="Drop folder of sonar images or click to browse folder"
              style={{
                borderRadius: 14,
                border: `1.5px dashed ${dragOver ? '#0f172a' : '#cbd5e1'}`,
                background: dragOver ? '#f1f5f9' : '#ffffff',
                padding: '22px 14px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 180ms ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: '#f8fafc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                }}>
                  <Folder size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                    {dragOver ? 'Release to ingest folder' : 'Select or Drop Sonar Folder'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    click to <span style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'underline' }}>browse directory</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                  Auto-detects all valid sonar survey frames
                </div>
              </div>
            </div>
          )}

          {/* Folder input with directory attributes */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            style={{ display: 'none' }}
            onChange={onFolderInputChange}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
