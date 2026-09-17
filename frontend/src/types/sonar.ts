// src/types/sonar.ts

export type HazardRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TargetClass = 'crab_pot' | 'submarine_pipeline' | 'shipwreck' | 'ghost_net' | 'mine_cylinder';
export type ShadowEvidence = 'SUPPORTING' | 'NEUTRAL' | 'ABSENT';
export type AnalysisStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
export type ComputeTier = 'A' | 'B' | 'C';
export type UploadMode = 'single' | 'folder';

export interface GeoCoordinate {
  lat: number;
  lon: number;
  heading?: number;
}

export interface LocalOffset {
  x_m: number;
  y_m: number;
}

export interface Detection {
  id: string;
  target_class: TargetClass;
  confidence: number;
  confidence_ai?: number;
  shadow_evidence: ShadowEvidence;
  review_status?: string;
  shadow_contrast?: number;
  dimensions: {
    length_m: number;
    width_m: number;
    area_m2: number;
    relief_height_m: number;
  };
  geolocation: GeoCoordinate | null;
  local_offset: LocalOffset | null;
  hazard_risk: HazardRisk;
  bounding_box: [number, number, number, number];
  raw_box?: [number, number, number, number];
  mask_contour: Array<[number, number]>;
  thumbnail_base64: string;
}

export interface AnalysisResult {
  raw_image_url: string;
  enhanced_image_url: string;
  detections: Detection[];
  kpis: {
    total_surveys: number;
    total_detections: number;
    verified_3d_objects: number;
    critical_hazards: number;
  };
  processing_meta: {
    slant_range_corrected: boolean;
    clahe_applied: boolean;
    nadir_excised: boolean;
    confidence_threshold: number;
    processing_time_ms: number;
  };
}

export interface ProcessingParams {
  slant_range_correction: boolean;
  clahe_equalization: boolean;
  nadir_excision: boolean;
  confidence_threshold: number;
  test_interval_seconds?: number;
}

export interface GpuDetail {
  name: string;
  vram_gb: number | null;
}

export interface SystemInfo {
  cpuCores: number;
  cpuName?: string;
  physicalCores?: number;
  deviceMemoryGb: number | null;
  ramTotalGb?: number | null;
  ramAvailableGb?: number | null;
  gpuRenderer: string;
  gpuName?: string;
  vramGb?: number | null;
  gpus?: GpuDetail[];
  webgl: boolean;
  canvas2d: boolean;
  sharedArrayBuffer: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

export interface BatchImageRecord {
  sequence: number;
  filename: string;
  timestamp: string;
  image_width?: number | null;
  image_height?: number | null;
  detection_count: number;
  gps: {
    latitude: number | null;
    longitude: number | null;
    heading?: number | null;
    progress_pct?: number | null;
  } | null;
  status: 'processed' | 'failed';
  error?: string;
  processing_time_ms: number;
  detections?: Detection[];
}

export interface BatchProgressState {
  sequence: number;
  total: number;
  currentFilename: string;
  processedCount: number;
  failedCount: number;
  status: 'running' | 'completed' | 'cancelled' | 'error';
}

export interface BatchDownloadUrls {
  csv: string;
  json: string;
  zip: string;
}

export interface AppState {
  uploadMode: UploadMode;
  sonarFile: File | null;
  batchFiles: File[];
  navCsvFile: File | null;
  params: ProcessingParams;
  status: AnalysisStatus;
  result: AnalysisResult | null;
  selectedDetectionId: string | null;
  error: string | null;
  computeTier: ComputeTier;
  userLocation: GeoCoordinate | null;
  locationError: string | null;
  backendOnline: boolean;
  
  // Batch & Arabian Sea Simulation State
  isSimulationMode: boolean;
  batchId: string | null;
  batchProgress: BatchProgressState | null;
  batchResults: BatchImageRecord[];
  simulatedBaseRoute: GeoCoordinate[];
  travelledRoute: GeoCoordinate[];
  currentSubmarineLocation: GeoCoordinate | null;
  batchDownloadUrls: BatchDownloadUrls | null;
}
