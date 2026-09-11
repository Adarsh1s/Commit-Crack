// src/hooks/useAnalysis.ts
import { useCallback } from 'react';
import { useAppContext } from '../store/AppContext';

const BACKEND_URL = 'http://localhost:8000';

export function useAnalysis() {
  const { state, dispatch } = useAppContext();

  const runAnalysis = useCallback(async () => {
    if (!state.sonarFile) return;
    dispatch({ type: 'SET_STATUS', payload: 'uploading' });

    const form = new FormData();
    // Backend expects the image field to be named 'file'
    form.append('file', state.sonarFile, state.sonarFile.name);
    if (state.navCsvFile) form.append('nav_csv', state.navCsvFile, state.navCsvFile.name);
    form.append('slant_range_correction', String(state.params.slant_range_correction));
    form.append('clahe_equalization', String(state.params.clahe_equalization));
    form.append('nadir_excision', String(state.params.nadir_excision));
    form.append('confidence_threshold', String(state.params.confidence_threshold));

    // Only pass vessel GPS coordinates if they are valid numbers
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

      const result = await res.json();
      dispatch({ type: 'SET_RESULT', payload: result });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    }
  }, [state, dispatch]);

  return { runAnalysis, status: state.status, result: state.result, error: state.error };
}
