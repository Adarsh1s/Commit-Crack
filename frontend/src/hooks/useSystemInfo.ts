// src/hooks/useSystemInfo.ts
import { useState } from 'react';
import type { SystemInfo } from '../types/sonar';

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
  const [info] = useState<SystemInfo>(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
    };

    return {
      cpuCores: navigator.hardwareConcurrency ?? 2,
      deviceMemoryGb: nav.deviceMemory ?? null,
      gpuRenderer: getGpuRenderer(),
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

  return info;
}
