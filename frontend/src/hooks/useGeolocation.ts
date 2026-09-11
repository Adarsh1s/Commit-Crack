// src/hooks/useGeolocation.ts
import { useState, useCallback } from 'react';
import type { GeoCoordinate } from '../types/sonar';

interface GeolocationState {
  location: GeoCoordinate | null;
  error: string | null;
  loading: boolean;
  fetch: () => void;
}

export function useGeolocation(): GeolocationState {
  const [location, setLocation] = useState<GeoCoordinate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        const messages: Record<number, string> = {
          1: 'Location access denied by user',
          2: 'Position unavailable — no GPS signal',
          3: 'Location request timed out',
        };
        setError(messages[err.code] ?? 'Location unavailable');
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { location, error, loading, fetch };
}
