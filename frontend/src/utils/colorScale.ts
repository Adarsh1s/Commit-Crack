// src/utils/colorScale.ts
import type { HazardRisk, TargetClass } from '../types/sonar';

export const RISK_COLORS: Record<HazardRisk, string> = {
  LOW:      '#34d399',
  MEDIUM:   '#fbbf24',
  HIGH:     '#f87171',
  CRITICAL: '#ff3b3b',
};

export const RISK_GLOW: Record<HazardRisk, string> = {
  LOW:      'rgba(52, 211, 153, 0.4)',
  MEDIUM:   'rgba(251, 191, 36, 0.4)',
  HIGH:     'rgba(248, 113, 113, 0.4)',
  CRITICAL: 'rgba(255, 59, 59, 0.6)',
};

export const CLASS_COLORS: Record<TargetClass, string> = {
  crab_pot:           '#2dd4bf',
  submarine_pipeline: '#0ea5e9',
  shipwreck:          '#a855f7',
  ghost_net:          '#fbbf24',
  mine_cylinder:      '#ef4444',
};

export function confidenceToColor(confidence: number): string {
  if (confidence >= 0.7) return '#34d399';
  if (confidence >= 0.4) return '#fbbf24';
  return '#f87171';
}
