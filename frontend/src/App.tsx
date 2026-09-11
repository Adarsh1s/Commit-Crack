import React, { useState } from 'react';
import { LoadingScreen } from './components/loading/LoadingScreen';
import { AppShell } from './components/layout/AppShell';
import { AppProvider } from './store/AppContext';
import { CursorTrail } from './components/common/CursorTrail';
import type { ComputeTier, GeoCoordinate } from './types/sonar';

type Phase = 'loading' | 'app';

interface InitData {
  tier: ComputeTier;
  location: GeoCoordinate | null;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [initData, setInitData] = useState<InitData | null>(null);

  const handleLoadingComplete = (tier: ComputeTier, location: GeoCoordinate | null) => {
    setInitData({ tier, location });
    setPhase('app');
  };

  return (
    <>
      <CursorTrail />
      {phase === 'loading' || !initData ? (
        <LoadingScreen onComplete={handleLoadingComplete} />
      ) : (
        <AppProvider initialTier={initData.tier} initialLocation={initData.location}>
          <AppShell />
        </AppProvider>
      )}
    </>
  );
}
