// src/hooks/useSystemInfo.ts
import { useState, useEffect } from 'react';
import type { SystemInfo, GpuDetail } from '../types/sonar';
import { BACKEND_URL } from '../utils/apiConfig';

export function parseGpuName(raw: string): string {
  if (!raw || raw === 'WebGL unavailable' || raw === 'GPU info restricted') return raw;
  let clean = raw.replace(/^ANGLE \([^,]+,\s*(.+?)\s*Direct3D.*?\)$/i, '$1');
  clean = clean.replace(/^ANGLE \([^,]+,\s*(.+?)\)$/i, '$1');
  clean = clean.replace(/^ANGLE \((.+?)\)$/i, '$1');
  clean = clean.replace(/\(R\)/gi, '®').replace(/\(TM\)/gi, '™');
  return clean.trim();
}

function getGpuRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl) return 'WebGL unavailable';
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'GPU info restricted';
    return (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
  } catch {
    return 'Unknown GPU';
  }
}

function hasCanvas2D(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('2d');
  } catch {
    return false;
  }
}

export function useSystemInfo(): SystemInfo {
  const [info, setInfo] = useState<SystemInfo>(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
    };
    const rawGpu = getGpuRenderer();
    const cleanGpu = parseGpuName(rawGpu);

    return {
      cpuCores: navigator.hardwareConcurrency ?? 8,
      physicalCores: Math.max(1, Math.floor((navigator.hardwareConcurrency ?? 8) / 2)),
      deviceMemoryGb: nav.deviceMemory ?? null,
      ramTotalGb: nav.deviceMemory ? Number(nav.deviceMemory) : null,
      ramAvailableGb: null,
      gpuRenderer: rawGpu,
      gpuName: cleanGpu,
      vramGb: null,
      gpus: [],
      webgl: (() => {
        try {
          const c = document.createElement('canvas');
          return !!(c.getContext('webgl') ?? c.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      })(),
      canvas2d: hasCanvas2D(),
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      userAgent: navigator.userAgent.slice(0, 80),
    };
  });

  useEffect(() => {
    let active = true;

    async function fetchBackendHardware() {
      try {
        // Try /system-info endpoint first, then /health
        let res = await fetch(`${BACKEND_URL}/system-info`, {
          signal: AbortSignal.timeout(2500),
        }).catch(() => null);

        let data: any = null;
        if (res && res.ok) {
          data = await res.json();
        } else {
          // Fallback to /health
          const healthRes = await fetch(`${BACKEND_URL}/health`, {
            signal: AbortSignal.timeout(2500),
          }).catch(() => null);
          if (healthRes && healthRes.ok) {
            const healthJson = await healthRes.json();
            if (healthJson.hardware) {
              data = healthJson.hardware;
            }
          }
        }

        if (data && active) {
          setInfo((prev) => ({
            ...prev,
            cpuCores: data.logical_cores || prev.cpuCores,
            physicalCores: data.physical_cores || prev.physicalCores,
            cpuName: data.cpu_name || prev.cpuName,
            ramTotalGb: data.ram_total_gb || prev.ramTotalGb,
            ramAvailableGb: data.ram_available_gb ?? prev.ramAvailableGb,
            gpuName: data.primary_gpu || prev.gpuName,
            vramGb: data.vram_gb ?? prev.vramGb,
            gpus: data.gpus || prev.gpus,
          }));
        }
      } catch {
        // Silently preserve browser defaults if backend is currently launching
      }
    }

    fetchBackendHardware();
    const interval = setInterval(fetchBackendHardware, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return info;
}
