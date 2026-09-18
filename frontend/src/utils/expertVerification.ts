// src/utils/expertVerification.ts
import type { Detection, HazardRisk } from '../types/sonar';

/**
 * Requirement 1: Treat only HIGH and CRITICAL hazard/danger levels as high-risk.
 */
export function isHighRisk(hazard: HazardRisk): boolean {
  return hazard === 'HIGH' || hazard === 'CRITICAL';
}

/**
 * Requirement 2 & 9:
 * If the detection is HIGH or CRITICAL AND AI confidence is MORE THAN 75% (confidence > 0.75):
 * - Show a clearly visible high-risk alert to the user.
 * - confidence == 0.75 is explicitly NOT included in this range.
 */
export function shouldShowHighRiskAlert(
  hazard: HazardRisk,
  confidence: number
): boolean {
  return isHighRisk(hazard) && confidence > 0.75;
}

/**
 * Expert Verification Condition:
 * If the detection has risk level HIGH or CRITICAL AND AI confidence is BELOW 35% (confidence < 0.35):
 * - Show the "Expert Verification" option for that specific detection.
 */
export function isVerificationEligible(
  hazard: HazardRisk,
  confidence: number
): boolean {
  return isHighRisk(hazard) && confidence < 0.35;
}

/**
 * Returns a human-friendly label for target classes.
 */
export const TARGET_CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  submarine_pipeline: 'Submarine Pipeline',
  shipwreck: 'Shipwreck',
  ghost_net: 'Ghost Net',
  mine_cylinder: 'Mine / Cylinder',
};

export function getTargetClassLabel(targetClass: string): string {
  return TARGET_CLASS_LABELS[targetClass] ?? targetClass.replace(/_/g, ' ').toUpperCase();
}
