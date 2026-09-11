// src/components/loading/LoadingScreen.tsx
// Seamless cross-fade orchestrator:
// LogoIntroScene smoothly animates the logo with sonar pulses, then cross-fades into LaunchPanel.

import React, { useState } from 'react';
import { LogoIntroScene } from './LogoIntroScene';
import { LaunchPanel } from './LaunchPanel';
import { useSystemInfo } from '../../hooks/useSystemInfo';
import type { ComputeTier, GeoCoordinate } from '../../types/sonar';

interface Props {
  onComplete: (tier: ComputeTier, location: GeoCoordinate | null) => void;
}

export function LoadingScreen({ onComplete }: Props) {
  const [introMounted, setIntroMounted] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const systemInfo = useSystemInfo();

  const handleFadeStart = () => {
    setIsFading(true);
    setPanelVisible(true);
  };

  const handleIntroComplete = () => {
    setIntroMounted(false);
    setPanelVisible(true);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* Launch Panel (mounted and ready to receive seamless cross-fade) */}
      <LaunchPanel
        systemInfo={systemInfo}
        onConfirm={onComplete}
        visible={panelVisible}
      />

      {/* Logo Intro Scene (animates with concentric sonar waves and dissolves into launch panel) */}
      {introMounted && (
        <LogoIntroScene
          isFading={isFading}
          onFadeStart={handleFadeStart}
          onComplete={handleIntroComplete}
        />
      )}
    </div>
  );
}

