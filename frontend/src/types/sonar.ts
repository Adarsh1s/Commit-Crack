// src/types/sonar.ts

export type HazardRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TargetClass = 'crab_pot' | 'submarine_pipeline' | 'shipwreck' | 'ghost_net' | 'mine_cylinder';
export type ShadowEvidence = 'SUPPORTING' | 'NEUTRAL' | 'ABSENT';
export type AnalysisStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
export type ComputeTier = 'A' | 'B' | 'C';

export interface GeoCoordinate {
  lat: number;
  lon: number;
}

export interface LocalOffset {
  x_m: number;
  y_m: number;
}

export interface Detection {
  id: string;
  target_class: TargetClass;
  confidence: number;
  shadow_evidence: ShadowEvidence;
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

export interface AppState {
  sonarFile: File | null;
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
}
