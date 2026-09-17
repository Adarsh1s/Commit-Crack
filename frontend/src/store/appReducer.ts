// src/store/appReducer.ts
import type {
  AppState,
  AnalysisResult,
  ProcessingParams,
  ComputeTier,
  GeoCoordinate,
  UploadMode,
  BatchProgressState,
  BatchImageRecord,
  BatchDownloadUrls,
} from '../types/sonar';

export type AppAction =
  | { type: 'SET_UPLOAD_MODE'; payload: UploadMode }
  | { type: 'SET_SONAR_FILE'; payload: File }
  | { type: 'CLEAR_SONAR_FILE' }
  | { type: 'SET_BATCH_FILES'; payload: File[] }
  | { type: 'CLEAR_BATCH_FILES' }
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
  | { type: 'SET_SIMULATION_BASE_ROUTE'; payload: GeoCoordinate[] }
  | { type: 'START_BATCH_RUN'; payload: { batchId: string; total: number } }
  | {
      type: 'BATCH_EVENT_IMAGE_STARTED';
      payload: { sequence: number; total: number; filename: string; gps?: GeoCoordinate | null };
    }
  | {
      type: 'BATCH_EVENT_IMAGE_PROCESSED';
      payload: {
        sequence: number;
        total: number;
        filename: string;
        gps?: { latitude: number | null; longitude: number | null } | null;
        result: AnalysisResult;
        record: BatchImageRecord;
      };
    }
  | {
      type: 'BATCH_EVENT_IMAGE_FAILED';
      payload: { sequence: number; total: number; filename: string; error: string; record: BatchImageRecord };
    }
  | {
      type: 'BATCH_EVENT_COMPLETED';
      payload: { downloadUrls: BatchDownloadUrls; total: number; processed: number; failed: number };
    }
  | {
      type: 'BATCH_EVENT_CANCELLED';
      payload: { downloadUrls: BatchDownloadUrls; total: number; processed: number; failed: number };
    }
  | { type: 'CANCEL_BATCH' }
  | { type: 'RESET' };

export const initialState: AppState = {
  uploadMode: 'single',
  sonarFile: null,
  batchFiles: [],
  navCsvFile: null,
  params: {
    slant_range_correction: true,
    clahe_equalization: true,
    nadir_excision: false,
    confidence_threshold: 0.25,
    test_interval_seconds: 2.0,
  },
  status: 'idle',
  result: null,
  selectedDetectionId: null,
  error: null,
  computeTier: 'B',
  userLocation: null,
  locationError: null,
  backendOnline: false,

  // Batch & Arabian Sea Simulation
  isSimulationMode: false,
  batchId: null,
  batchProgress: null,
  batchResults: [],
  simulatedBaseRoute: [],
  travelledRoute: [],
  currentSubmarineLocation: null,
  batchDownloadUrls: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_UPLOAD_MODE':
      return {
        ...state,
        uploadMode: action.payload,
        isSimulationMode: action.payload === 'folder',
        error: null,
      };

    case 'SET_SONAR_FILE':
      return {
        ...state,
        sonarFile: action.payload,
        uploadMode: 'single',
        isSimulationMode: false,
        status: 'idle',
        result: null,
        error: null,
      };

    case 'CLEAR_SONAR_FILE':
      return { ...state, sonarFile: null, status: 'idle', result: null };

    case 'SET_BATCH_FILES': {
      const startCoord = state.simulatedBaseRoute[0] || { lat: 18.8, lon: 72.6 };
      return {
        ...state,
        batchFiles: action.payload,
        uploadMode: 'folder',
        isSimulationMode: true,
        status: 'idle',
        batchProgress: null,
        batchResults: [],
        travelledRoute: [startCoord],
        currentSubmarineLocation: startCoord,
        batchDownloadUrls: null,
        error: null,
      };
    }

    case 'CLEAR_BATCH_FILES':
      return {
        ...state,
        batchFiles: [],
        status: 'idle',
        batchProgress: null,
        batchResults: [],
        travelledRoute: [],
        currentSubmarineLocation: null,
        batchDownloadUrls: null,
      };

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

    case 'SET_SIMULATION_BASE_ROUTE':
      return {
        ...state,
        simulatedBaseRoute: action.payload,
        currentSubmarineLocation:
          state.uploadMode === 'folder' && !state.currentSubmarineLocation && action.payload.length > 0
            ? action.payload[0]
            : state.currentSubmarineLocation,
        travelledRoute:
          state.uploadMode === 'folder' && state.travelledRoute.length === 0 && action.payload.length > 0
            ? [action.payload[0]]
            : state.travelledRoute,
      };

    case 'START_BATCH_RUN': {
      const startCoord = state.simulatedBaseRoute[0] || { lat: 18.8, lon: 72.6 };
      return {
        ...state,
        status: 'processing',
        isSimulationMode: true,
        batchId: action.payload.batchId,
        batchResults: [],
        travelledRoute: [startCoord],
        currentSubmarineLocation: startCoord,
        batchDownloadUrls: null,
        batchProgress: {
          sequence: 0,
          total: action.payload.total,
          currentFilename: '',
          processedCount: 0,
          failedCount: 0,
          status: 'running',
        },
        error: null,
      };
    }

    case 'BATCH_EVENT_IMAGE_STARTED': {
      if (state.status !== 'processing') return state;
      const nextTravelled = [...state.travelledRoute];
      let nextSubmarineLoc = state.currentSubmarineLocation;

      const gps = action.payload.gps as any;
      if (gps) {
        const lat = typeof gps.lat === 'number' ? gps.lat : typeof gps.latitude === 'number' ? gps.latitude : null;
        const lon = typeof gps.lon === 'number' ? gps.lon : typeof gps.longitude === 'number' ? gps.longitude : null;
        const heading = typeof gps.heading === 'number' ? gps.heading : 180;
        if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
          const coord: GeoCoordinate = { lat, lon, heading };
          const last = nextTravelled[nextTravelled.length - 1];
          if (!last || last.lat !== coord.lat || last.lon !== coord.lon) {
            nextTravelled.push(coord);
          }
          nextSubmarineLoc = coord;
        }
      }

      return {
        ...state,
        currentSubmarineLocation: nextSubmarineLoc,
        travelledRoute: nextTravelled,
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              sequence: action.payload.sequence,
              currentFilename: action.payload.filename,
            }
          : null,
      };
    }

    case 'BATCH_EVENT_IMAGE_PROCESSED': {
      if (state.status !== 'processing') return state;
      const { sequence, total, filename, gps, result, record } = action.payload as any;
      const nextTravelled = [...state.travelledRoute];
      let nextSubmarineLoc = state.currentSubmarineLocation;

      if (gps) {
        const lat = typeof gps.lat === 'number' ? gps.lat : typeof gps.latitude === 'number' ? gps.latitude : null;
        const lon = typeof gps.lon === 'number' ? gps.lon : typeof gps.longitude === 'number' ? gps.longitude : null;
        const heading = typeof gps.heading === 'number' ? gps.heading : 180;
        if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
          const coord: GeoCoordinate = { lat, lon, heading };
          const last = nextTravelled[nextTravelled.length - 1];
          if (!last || last.lat !== coord.lat || last.lon !== coord.lon) {
            nextTravelled.push(coord);
          }
          nextSubmarineLoc = coord;
        }
      }

      return {
        ...state,
        result, // Update live preview in inspector & viewer
        currentSubmarineLocation: nextSubmarineLoc,
        travelledRoute: nextTravelled,
        batchResults: [...state.batchResults, record],
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              sequence,
              total,
              currentFilename: filename,
              processedCount: state.batchProgress.processedCount + 1,
            }
          : null,
      };
    }

    case 'BATCH_EVENT_IMAGE_FAILED': {
      if (state.status !== 'processing') return state;
      const { sequence, total, filename, record } = action.payload;
      return {
        ...state,
        batchResults: [...state.batchResults, record],
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              sequence,
              total,
              currentFilename: filename,
              failedCount: state.batchProgress.failedCount + 1,
            }
          : null,
      };
    }

    case 'BATCH_EVENT_COMPLETED':
      if (state.status !== 'processing') return state;
      return {
        ...state,
        status: 'complete',
        batchDownloadUrls: action.payload.downloadUrls,
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              status: 'completed',
              processedCount: action.payload.processed,
              failedCount: action.payload.failed,
            }
          : null,
      };

    case 'BATCH_EVENT_CANCELLED': {
      const startCoord = state.simulatedBaseRoute[0] || { lat: 18.8, lon: 72.6 };
      return {
        ...state,
        status: 'idle',
        batchId: null,
        batchProgress: null,
        batchResults: [],
        result: null,
        selectedDetectionId: null,
        error: null,
        currentSubmarineLocation: startCoord,
        travelledRoute: [startCoord],
        batchDownloadUrls: null,
      };
    }

    case 'CANCEL_BATCH': {
      const startCoord = state.simulatedBaseRoute[0] || { lat: 18.8, lon: 72.6 };
      return {
        ...state,
        status: 'idle',
        batchId: null,
        batchProgress: null,
        batchResults: [],
        result: null,
        selectedDetectionId: null,
        error: null,
        currentSubmarineLocation: startCoord,
        travelledRoute: [startCoord],
        batchDownloadUrls: null,
      };
    }

    case 'RESET':
      return {
        ...initialState,
        computeTier: state.computeTier,
        userLocation: state.userLocation,
        backendOnline: state.backendOnline,
        simulatedBaseRoute: state.simulatedBaseRoute,
      };

    default:
      return state;
  }
}
