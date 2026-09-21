// src/hooks/useSystemInfo.ts
import { useState, useEffect } from 'react';
import type { SystemInfo, GpuDetail } from '../types/sonar';
import { getBackendUrl, isMixedContentUrl } from '../utils/apiConfig';

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
    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
    const gpuRaw = typeof window !== 'undefined' ? getGpuRenderer() : 'Unknown GPU';
    return {
      cpuCores: nav.hardwareConcurrency || 4,
      deviceMemoryGb: (nav as any).deviceMemory || null,
      gpuRenderer: gpuRaw,
      gpuName: parseGpuName(gpuRaw),
      webgl: typeof window !== 'undefined' && !!window.WebGLRenderingContext,
      canvas2d: hasCanvas2D(),
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      screenWidth: typeof window !== 'undefined' ? window.screen.width : 1920,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : 1080,
      userAgent: (nav.userAgent || '').slice(0, 80),
    };
  });

  useEffect(() => {
    let active = true;

    async function fetchBackendHardware() {
      const url = getBackendUrl();
      if (isMixedContentUrl(url)) return;

      try {
        // Try /system-info endpoint first, then /health
        let res = await fetch(`${url}/system-info`, {
          signal: AbortSignal.timeout(2500),
        }).catch(() => null);

        let data: any = null;
        if (res && res.ok) {
          data = await res.json();
        } else {
          // Fallback to /health
          const healthRes = await fetch(`${url}/health`, {
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
