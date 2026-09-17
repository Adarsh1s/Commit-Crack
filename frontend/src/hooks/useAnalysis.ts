// src/hooks/useAnalysis.ts
import { useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import type { BatchImageRecord, AnalysisResult } from '../types/sonar';

const BACKEND_URL = 'http://localhost:8000';

export function useAnalysis() {
  const { state, dispatch } = useAppContext();
  const activeBatchIdRef = useRef<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Keep ref synchronized with state.batchId
  useEffect(() => {
    if (state.batchId) {
      activeBatchIdRef.current = state.batchId;
    }
  }, [state.batchId]);

  // Load Arabian Sea simulation base route on mount
  useEffect(() => {
    async function loadRoute() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/simulation/route`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.waypoints)) {
            dispatch({ type: 'SET_SIMULATION_BASE_ROUTE', payload: data.waypoints });
          }
        }
      } catch {
        // Backend offline; will retry or populate when available
      }
    }
    loadRoute();
  }, [dispatch, state.backendOnline]);

  const runSingleAnalysis = useCallback(async () => {
    if (!state.sonarFile) return;
    dispatch({ type: 'SET_STATUS', payload: 'uploading' });

    const form = new FormData();
    form.append('file', state.sonarFile, state.sonarFile.name);
    if (state.navCsvFile) form.append('nav_csv', state.navCsvFile, state.navCsvFile.name);
    form.append('slant_range_correction', String(state.params.slant_range_correction));
    form.append('clahe_equalization', String(state.params.clahe_equalization));
    form.append('nadir_excision', String(state.params.nadir_excision));
    form.append('confidence_threshold', String(state.params.confidence_threshold));

    if (
      state.userLocation &&
      typeof state.userLocation.lat === 'number' &&
      Number.isFinite(state.userLocation.lat) &&
      typeof state.userLocation.lon === 'number' &&
      Number.isFinite(state.userLocation.lon)
    ) {
      form.append('vessel_lat', String(state.userLocation.lat));
      form.append('vessel_lon', String(state.userLocation.lon));
    }

    try {
      dispatch({ type: 'SET_STATUS', payload: 'processing' });
      const res = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        let errorMsg = `Server error (${res.status} ${res.statusText})`;
        if (errData && errData.detail) {
          if (typeof errData.detail === 'string') {
            errorMsg = errData.detail;
          } else if (Array.isArray(errData.detail)) {
            errorMsg = errData.detail
              .map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d)))
              .join(', ');
          } else {
            errorMsg = JSON.stringify(errData.detail);
          }
        }
        throw new Error(errorMsg);
      }

      const result: AnalysisResult = await res.json();
      dispatch({ type: 'SET_RESULT', payload: result });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    }
  }, [state, dispatch]);

  const runBatchAnalysis = useCallback(async () => {
    if (!state.batchFiles || state.batchFiles.length === 0) return;

    isCancelledRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const form = new FormData();
    state.batchFiles.forEach((file) => {
      form.append('files', file, file.name);
    });

    form.append('slant_range_correction', String(state.params.slant_range_correction));
    form.append('clahe_equalization', String(state.params.clahe_equalization));
    form.append('nadir_excision', String(state.params.nadir_excision));
    form.append('confidence_threshold', String(state.params.confidence_threshold));
    if (state.params.test_interval_seconds != null) {
      form.append('interval_seconds', String(state.params.test_interval_seconds));
    }

    try {
      dispatch({ type: 'SET_STATUS', payload: 'uploading' });

      const response = await fetch(`${BACKEND_URL}/api/v1/batch/start`, {
        method: 'POST',
        body: form,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Failed to start batch (${response.status})`);
      }

      const batchIdHeader = response.headers.get('X-Batch-ID') || `batch_${Date.now()}`;
      activeBatchIdRef.current = batchIdHeader;
      dispatch({
        type: 'START_BATCH_RUN',
        payload: { batchId: batchIdHeader, total: state.batchFiles.length },
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported by browser.');
      readerRef.current = reader;

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        if (isCancelledRef.current) break;
        const { done, value } = await reader.read();
        if (done || isCancelledRef.current) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';

        for (const block of parts) {
          if (isCancelledRef.current) break;
          const lines = block.split(/\r?\n/);
          for (const rawLine of lines) {
            if (isCancelledRef.current) break;
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;

            const jsonStr = line.replace(/^data:\s*/, '');
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'batch_started') {
                if (event.batch_id) {
                  activeBatchIdRef.current = event.batch_id;
                  dispatch({
                    type: 'START_BATCH_RUN',
                    payload: { batchId: event.batch_id, total: event.total_images },
                  });
                }
              } else if (event.type === 'image_started') {
                dispatch({
                  type: 'BATCH_EVENT_IMAGE_STARTED',
                  payload: {
                    sequence: event.sequence,
                    total: event.total,
                    filename: event.filename,
                    gps: event.gps,
                  },
                });
              } else if (event.type === 'image_processed') {
                const record: BatchImageRecord = {
                  sequence: event.sequence,
                  filename: event.filename,
                  timestamp: event.timestamp,
                  detection_count: event.detection_count,
                  gps: event.gps,
                  status: 'processed',
                  processing_time_ms: event.processing_time_ms,
                  detections: event.detections,
                };

                dispatch({
                  type: 'BATCH_EVENT_IMAGE_PROCESSED',
                  payload: {
                    sequence: event.sequence,
                    total: event.total,
                    filename: event.filename,
                    gps: event.gps,
                    result: event.result,
                    record,
                  },
                });
              } else if (event.type === 'image_failed') {
                const record: BatchImageRecord = {
                  sequence: event.sequence,
                  filename: event.filename,
                  timestamp: event.timestamp,
                  detection_count: 0,
                  gps: event.gps,
                  status: 'failed',
                  error: event.error,
                  processing_time_ms: 0,
                  detections: [],
                };

                dispatch({
                  type: 'BATCH_EVENT_IMAGE_FAILED',
                  payload: {
                    sequence: event.sequence,
                    total: event.total,
                    filename: event.filename,
                    error: event.error,
                    record,
                  },
                });
              } else if (event.type === 'batch_completed') {
                dispatch({
                  type: 'BATCH_EVENT_COMPLETED',
                  payload: {
                    downloadUrls: event.download_urls,
                    total: event.total_images,
                    processed: event.processed_images,
                    failed: event.failed_images,
                  },
                });
              } else if (event.type === 'batch_cancelled') {
                dispatch({
                  type: 'BATCH_EVENT_CANCELLED',
                  payload: {
                    downloadUrls: event.download_urls,
                    total: event.total_images,
                    processed: event.processed_images,
                    failed: event.failed_images,
                  },
                });
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE line:', jsonStr, parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      if (isCancelledRef.current || err?.name === 'AbortError') {
        // User intentionally cancelled; return cleanly without setting error state
        return;
      }
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Batch streaming failed',
      });
    } finally {
      readerRef.current = null;
      abortControllerRef.current = null;
    }
  }, [state, dispatch]);

  const cancelBatch = useCallback(async () => {
    isCancelledRef.current = true;
    const bId = activeBatchIdRef.current || state.batchId;

    // Immediately restore frontend to original ready state
    dispatch({ type: 'CANCEL_BATCH' });

    // Abort active fetch & stream reader immediately
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch {}
      readerRef.current = null;
    }

    // Signal backend to immediately halt batch processing loop
    try {
      if (bId) {
        await fetch(`${BACKEND_URL}/api/v1/batch/${bId}/cancel`, {
          method: 'POST',
        });
      }
      await fetch(`${BACKEND_URL}/api/v1/batch/cancel`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('Failed to signal batch cancellation to backend:', err);
    }
  }, [state.batchId, dispatch]);

  const runAnalysis = useCallback(() => {
    if (state.uploadMode === 'folder') {
      runBatchAnalysis();
    } else {
      runSingleAnalysis();
    }
  }, [state.uploadMode, runBatchAnalysis, runSingleAnalysis]);

  return {
    runAnalysis,
    cancelBatch,
    status: state.status,
    result: state.result,
    error: state.error,
    batchProgress: state.batchProgress,
    batchDownloadUrls: state.batchDownloadUrls,
  };
}
