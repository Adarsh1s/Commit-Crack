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
  ClusterInfo,
  MapFilterState,
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
  | { type: 'SELECT_FRAME'; payload: { frameId: string | null; frame?: any | null } | null }
  | { type: 'SELECT_CLUSTER'; payload: ClusterInfo | null }
  | { type: 'SET_MAP_FILTERS'; payload: Partial<MapFilterState> }
  | { type: 'CONFIRM_EXPERT_VERIFICATION'; payload: { detectionId: string } }
  | { type: 'REJECT_DETECTION'; payload: { detectionId: string } }
  | { type: 'SKIP_EXPERT_VERIFICATION'; payload: { detectionId: string } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_COMPUTE_TIER'; payload: ComputeTier }
  | { type: 'SET_LOCATION'; payload: GeoCoordinate }
  | { type: 'SET_LOCATION_ERROR'; payload: string }
  | { type: 'SET_BACKEND_ONLINE'; payload: boolean }
  | {
      type: 'SET_SIMULATION_BASE_ROUTE';
      payload: GeoCoordinate[] | { waypoints: GeoCoordinate[]; routeInfo?: import('../types/sonar').SimulationRouteInfo };
    }
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

export const DEFAULT_MUMBAI_KOCHI_WAYPOINTS: GeoCoordinate[] = [
  { lat: 18.8000, lon: 72.6000 },
  { lat: 18.2500, lon: 72.7500 },
  { lat: 17.6500, lon: 72.9000 },
  { lat: 16.9500, lon: 73.0500 },
  { lat: 16.4500, lon: 73.2000 },
  { lat: 16.0000, lon: 73.3000 },
  { lat: 15.3500, lon: 73.5500 },
  { lat: 14.7500, lon: 73.9000 },
  { lat: 14.3000, lon: 74.1000 },
  { lat: 13.9500, lon: 74.3000 },
  { lat: 13.5000, lon: 74.4500 },
  { lat: 13.3000, lon: 74.5000 },
  { lat: 12.8000, lon: 74.6000 },
  { lat: 12.4500, lon: 74.7500 },
  { lat: 11.8000, lon: 75.1000 },
  { lat: 11.2000, lon: 75.5000 },
  { lat: 10.7500, lon: 75.7000 },
  { lat: 10.2500, lon: 75.9000 },
  { lat: 10.0000, lon: 76.0000 },
  { lat: 9.9600, lon: 76.2000 },
];

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
    test_interval_seconds: 0.2,
  },
  status: 'idle',
  result: null,
  selectedDetectionId: null,
  selectedFrameId: null,
  selectedFrame: null,
  selectedCluster: null,
  mapFilters: {
    risk: 'ALL',
    targetClass: 'ALL',
  },
  error: null,
  computeTier: 'B',
  userLocation: null,
  locationError: null,
  backendOnline: false,

  // Batch & Naval Patrol Simulation
  isSimulationMode: false,
  batchId: null,
  batchProgress: null,
  batchResults: [],
  simulatedBaseRoute: DEFAULT_MUMBAI_KOCHI_WAYPOINTS,
  simulationRouteInfo: {
    id: 'mumbai_kochi',
    name: 'Arabian Sea Western Shelf Deep Water Corridor',
    start: 'MUMBAI ANCHORAGE',
    end: 'KOCHI NAVAL PORT',
  },
  travelledRoute: [DEFAULT_MUMBAI_KOCHI_WAYPOINTS[0]],
  currentSubmarineLocation: DEFAULT_MUMBAI_KOCHI_WAYPOINTS[0],
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
      return {
        ...state,
        selectedDetectionId: action.payload,
        selectedCluster: action.payload ? null : state.selectedCluster,
      };

    case 'SELECT_FRAME':
      return {
        ...state,
        selectedFrameId: action.payload ? action.payload.frameId : null,
        selectedFrame: action.payload ? action.payload.frame ?? null : null,
        selectedCluster: action.payload ? null : state.selectedCluster,
        selectedDetectionId: null,
      };

    case 'SELECT_CLUSTER':
      return {
        ...state,
        selectedCluster: action.payload,
        selectedDetectionId: action.payload ? null : state.selectedDetectionId,
        selectedFrameId: action.payload ? null : state.selectedFrameId,
        selectedFrame: action.payload ? null : state.selectedFrame,
      };

    case 'SET_MAP_FILTERS':
      return {
        ...state,
        mapFilters: {
          ...state.mapFilters,
          ...action.payload,
        },
      };

    case 'CONFIRM_EXPERT_VERIFICATION': {
      const detectionId = action.payload.detectionId;
      const updateDet = (d: any) =>
        d.id === detectionId ? { ...d, expert_verified: true, expert_status: 'CONFIRMED' as const } : d;

      const updatedResult = state.result
        ? {
            ...state.result,
            detections: state.result.detections.map(updateDet),
          }
        : null;

      const updatedBatchResults = state.batchResults.map((rec) => ({
        ...rec,
        detections: rec.detections ? rec.detections.map(updateDet) : [],
      }));

      const updatedSelectedCluster = state.selectedCluster
        ? {
            ...state.selectedCluster,
            detections: state.selectedCluster.detections.map(updateDet),
            expertVerifiedCount: state.selectedCluster.detections.filter((d) => d.expert_verified || d.id === detectionId).length,
          }
        : null;

      return {
        ...state,
        result: updatedResult,
        batchResults: updatedBatchResults,
        selectedCluster: updatedSelectedCluster,
      };
    }

    case 'REJECT_DETECTION': {
      const detectionId = action.payload.detectionId;
      const isSelected = state.selectedDetectionId === detectionId;

      const updatedResult = state.result
        ? (() => {
            const nextDets = state.result.detections.filter((d) => d.id !== detectionId);
            const newCritical = nextDets.filter((d) => d.hazard_risk === 'CRITICAL').length;
            const newVerified3d = nextDets.filter((d) => d.shadow_evidence === 'SUPPORTING' || d.expert_verified).length;
            return {
              ...state.result,
              detections: nextDets,
              kpis: {
                ...state.result.kpis,
                total_detections: nextDets.length,
                critical_hazards: newCritical,
                verified_3d_objects: newVerified3d,
              },
            };
          })()
        : null;

      const updatedBatchResults = state.batchResults.map((rec) => {
        const nextDets = rec.detections ? rec.detections.filter((d) => d.id !== detectionId) : [];
        return {
          ...rec,
          detections: nextDets,
          detection_count: nextDets.length,
        };
      });

      let updatedSelectedCluster = state.selectedCluster;
      if (updatedSelectedCluster) {
        const nextClusterDets = updatedSelectedCluster.detections.filter((d) => d.id !== detectionId);
        if (nextClusterDets.length === 0) {
          updatedSelectedCluster = null;
        } else {
          updatedSelectedCluster = {
            ...updatedSelectedCluster,
            count: nextClusterDets.length,
            detections: nextClusterDets,
            expertVerifiedCount: nextClusterDets.filter((d) => d.expert_verified).length,
          };
        }
      }

      return {
        ...state,
        selectedDetectionId: isSelected ? null : state.selectedDetectionId,
        selectedCluster: updatedSelectedCluster,
        result: updatedResult,
        batchResults: updatedBatchResults,
      };
    }

    case 'SKIP_EXPERT_VERIFICATION': {
      const detectionId = action.payload.detectionId;
      const updateDet = (d: any) =>
        d.id === detectionId ? { ...d, expert_status: 'SKIPPED' as const } : d;

      const updatedResult = state.result
        ? {
            ...state.result,
            detections: state.result.detections.map(updateDet),
          }
        : null;

      const updatedBatchResults = state.batchResults.map((rec) => ({
        ...rec,
        detections: rec.detections ? rec.detections.map(updateDet) : [],
      }));

      return {
        ...state,
        result: updatedResult,
        batchResults: updatedBatchResults,
      };
    }

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

    case 'SET_SIMULATION_BASE_ROUTE': {
      const rawWaypoints = Array.isArray(action.payload) ? action.payload : action.payload.waypoints;
      const normalizedWaypoints: GeoCoordinate[] = (rawWaypoints || [])
        .map((p: any): GeoCoordinate | null => {
          if (!p) return null;
          const lat = typeof p.lat === 'number' ? p.lat : Array.isArray(p) && typeof p[0] === 'number' ? p[0] : null;
          const lon = typeof p.lon === 'number' ? p.lon : Array.isArray(p) && typeof p[1] === 'number' ? p[1] : null;
          if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
            return { lat, lon };
          }
          return null;
        })
        .filter((c): c is GeoCoordinate => c !== null);

      const routeInfo = Array.isArray(action.payload)
        ? state.simulationRouteInfo
        : (action.payload.routeInfo || state.simulationRouteInfo);

      const effectiveWaypoints = normalizedWaypoints.length > 0 ? normalizedWaypoints : state.simulatedBaseRoute;

      return {
        ...state,
        simulatedBaseRoute: effectiveWaypoints,
        simulationRouteInfo: routeInfo,
        currentSubmarineLocation:
          state.uploadMode === 'folder' && effectiveWaypoints.length > 0
            ? (state.currentSubmarineLocation || effectiveWaypoints[0])
            : state.currentSubmarineLocation,
        travelledRoute:
          state.uploadMode === 'folder' && state.travelledRoute.length === 0 && effectiveWaypoints.length > 0
            ? [effectiveWaypoints[0]]
            : state.travelledRoute,
      };
    }

    case 'START_BATCH_RUN': {
      const startCoord = state.simulatedBaseRoute[0] || { lat: 18.8, lon: 72.6 };
      return {
        ...state,
        uploadMode: 'folder',
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
        uploadMode: 'folder',
        status: 'processing',
        isSimulationMode: true,
        currentSubmarineLocation: nextSubmarineLoc,
        travelledRoute: nextTravelled,
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              sequence: action.payload.sequence,
              currentFilename: action.payload.filename,
            }
          : {
              sequence: action.payload.sequence,
              total: action.payload.total || 1,
              currentFilename: action.payload.filename,
              processedCount: 0,
              failedCount: 0,
              status: 'running',
            },
      };
    }

    case 'BATCH_EVENT_IMAGE_PROCESSED': {
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
        uploadMode: 'folder',
        status: 'processing',
        isSimulationMode: true,
        result: result || state.result, // Update live preview in inspector & viewer
        currentSubmarineLocation: nextSubmarineLoc,
        travelledRoute: nextTravelled,
        batchResults: [...state.batchResults, record],
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              sequence,
              total: total || state.batchProgress.total,
              currentFilename: filename,
              processedCount: state.batchProgress.processedCount + 1,
            }
          : {
              sequence,
              total: total || 1,
              currentFilename: filename,
              processedCount: 1,
              failedCount: 0,
              status: 'running',
            },
      };
    }

    case 'BATCH_EVENT_IMAGE_FAILED': {
      const { sequence, total, filename, error, record } = action.payload as any;
      return {
        ...state,
        uploadMode: 'folder',
        status: 'processing',
        batchResults: [...state.batchResults, record],
        batchProgress: state.batchProgress
          ? {
              ...state.batchProgress,
              sequence,
              total: total || state.batchProgress.total,
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
        mapFilters: state.mapFilters,
      };

    default:
      return state;
  }
}
