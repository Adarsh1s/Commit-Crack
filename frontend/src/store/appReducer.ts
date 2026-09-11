// src/store/appReducer.ts
import type { AppState, AnalysisResult, ProcessingParams, ComputeTier } from '../types/sonar';
import type { GeoCoordinate } from '../types/sonar';

export type AppAction =
  | { type: 'SET_SONAR_FILE'; payload: File }
  | { type: 'CLEAR_SONAR_FILE' }
  | { type: 'SET_NAV_FILE'; payload: File | null }
  | { type: 'SET_PARAMS'; payload: Partial<ProcessingParams> }
  | { type: 'SET_STATUS'; payload: AppState['status'] }
  | { type: 'SET_RESULT'; payload: AnalysisResult }
  | { type: 'SELECT_DETECTION'; payload: string | null }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_COMPUTE_TIER'; payload: ComputeTier }
  | { type: 'SET_LOCATION'; payload: GeoCoordinate }
  | { type: 'SET_LOCATION_ERROR'; payload: string }
  | { type: 'SET_BACKEND_ONLINE'; payload: boolean }
  | { type: 'RESET' };

export const initialState: AppState = {
  sonarFile: null,
  navCsvFile: null,
  params: {
    slant_range_correction: true,
    clahe_equalization: true,
    nadir_excision: false,
    confidence_threshold: 0.25,
  },
  status: 'idle',
  result: null,
  selectedDetectionId: null,
  error: null,
  computeTier: 'B',
  userLocation: null,
  locationError: null,
  backendOnline: false,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SONAR_FILE':
      return { ...state, sonarFile: action.payload, status: 'idle', result: null, error: null };
    case 'CLEAR_SONAR_FILE':
      return { ...state, sonarFile: null, status: 'idle', result: null };
    case 'SET_NAV_FILE':
      return { ...state, navCsvFile: action.payload };
    case 'SET_PARAMS':
      return { ...state, params: { ...state.params, ...action.payload } };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_RESULT':
      return { ...state, result: action.payload, status: 'complete', error: null };
    case 'SELECT_DETECTION':
      return { ...state, selectedDetectionId: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, status: 'error' };
    case 'SET_COMPUTE_TIER':
      return { ...state, computeTier: action.payload };
    case 'SET_LOCATION':
      return { ...state, userLocation: action.payload, locationError: null };
    case 'SET_LOCATION_ERROR':
      return { ...state, locationError: action.payload };
    case 'SET_BACKEND_ONLINE':
      return { ...state, backendOnline: action.payload };
    case 'RESET':
      return { ...initialState, computeTier: state.computeTier, userLocation: state.userLocation, backendOnline: state.backendOnline };
    default:
      return state;
  }
}
