// src/components/map/LeafletHeatLayer.tsx
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
// Imports the Leaflet Heat plugin which attaches L.heatLayer
import '@linkurious/leaflet-heat';

export interface HeatPoint {
  lat: number;
  lon: number;
  weight: number;
}

interface LeafletHeatLayerProps {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
  minOpacity?: number;
  gradient?: Record<number, string>;
}

/**
 * High-performance Canvas Heatmap layer utilizing `@linkurious/leaflet-heat`.
 * Renders exactly 1 weighted heat point per SurveyFrame.
 */
export function LeafletHeatLayer({
  points,
  radius = 28,
  blur = 20,
  maxZoom = 14,
  minOpacity = 0.35,
  gradient = {
    0.2: '#22c55e', // Low: Green
    0.4: '#eab308', // Med: Yellow
    0.65: '#f97316', // High: Orange
    0.85: '#ef4444', // Critical: Red
    1.0: '#991b1b', // Max: Crimson
  },
}: LeafletHeatLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    // Transform SurveyFrame points to [lat, lon, weight] tuples
    const latLngWeights = points.map((p) => [p.lat, p.lon, p.weight] as [number, number, number]);

    if (!heatLayerRef.current) {
      if ((L as any).heatLayer) {
        heatLayerRef.current = (L as any).heatLayer(latLngWeights, {
          radius,
          blur,
          maxZoom,
          minOpacity,
          gradient,
        }).addTo(map);
      }
    } else {
      heatLayerRef.current.setLatLngs(latLngWeights);
      heatLayerRef.current.setOptions({
        radius,
        blur,
        maxZoom,
        minOpacity,
        gradient,
      });
    }

    return () => {
      if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, radius, blur, maxZoom, minOpacity, gradient]);

  return null;
}
