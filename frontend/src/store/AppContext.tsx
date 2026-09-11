// src/store/AppContext.tsx
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { appReducer, initialState } from './appReducer';
import type { AppState, ComputeTier, GeoCoordinate } from '../types/sonar';
import type { AppAction } from './appReducer';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  initialTier?: ComputeTier;
  initialLocation?: GeoCoordinate | null;
}

export function AppProvider({ children, initialTier, initialLocation }: AppProviderProps) {
  const seedState: AppState = {
    ...initialState,
    computeTier: initialTier ?? initialState.computeTier,
    userLocation: initialLocation ?? null,
  };

  const [state, dispatch] = useReducer(appReducer, seedState);

  // Poll backend health every 10 seconds
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) });
      dispatch({ type: 'SET_BACKEND_ONLINE', payload: res.ok });
    } catch {
      dispatch({ type: 'SET_BACKEND_ONLINE', payload: false });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 10000);
    return () => clearInterval(id);
  }, [checkHealth]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
