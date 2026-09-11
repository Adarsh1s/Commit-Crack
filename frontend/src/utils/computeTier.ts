// src/utils/computeTier.ts
import type { ComputeTier, SystemInfo } from '../types/sonar';

export function detectComputeTier(info: SystemInfo): ComputeTier {
  const cores = info.cpuCores;
  const memGb = info.deviceMemoryGb ?? 4;

  if (cores >= 8 && memGb >= 8) return 'A';
  if (cores >= 4 && memGb >= 4) return 'B';
  return 'C';
}

export const TIER_LABELS: Record<ComputeTier, { label: string; desc: string; color: string }> = {
  A: {
    label: 'High Performance',
    desc: 'Full resolution · Multi-threaded inference · Real-time overlay',
    color: '#34d399',
  },
  B: {
    label: 'Balanced',
    desc: 'Standard resolution · Single-threaded · Batch processing',
    color: '#0ea5c8',
  },
  C: {
    label: 'Low Power',
    desc: 'Reduced resolution · Minimal processing · Power efficient',
    color: '#f59e0b',
  },
};
