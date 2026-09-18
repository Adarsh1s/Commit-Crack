// src/components/map/MarkerClusterGroup.tsx
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { SurveyFrame, ClusterInfo, HazardRisk } from '../../types/sonar';
import { RISK_COLORS } from '../../utils/colorScale';

interface MarkerClusterGroupProps {
  frames: SurveyFrame[];
  onSelectFrame: (frame: SurveyFrame) => void;
  onSelectCluster: (cluster: ClusterInfo) => void;
}

const CLASS_LABELS: Record<string, string> = {
  crab_pot: 'Crab Pot',
  submarine_pipeline: 'Submarine Pipeline',
  shipwreck: 'Shipwreck',
  ghost_net: 'Ghost Net',
  mine_cylinder: 'Mine / Cylinder',
};

/**
 * Creates tactical DivIcon for an individual SurveyFrame marker.
 */
export function createFrameMarkerIcon(frame: SurveyFrame): L.DivIcon {
  const riskColor = RISK_COLORS[frame.highestRisk] ?? '#0284c7';
  const hasVerified = frame.expertVerified;
  const count = frame.anomalyCount;

  return L.divIcon({
    className: 'aqua-frame-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <!-- Pulse ring for critical/high hazards -->
        ${
          frame.highestRisk === 'CRITICAL' || frame.highestRisk === 'HIGH'
            ? `<div style="
                position: absolute;
                inset: -2px;
                border-radius: 8px;
                background: ${riskColor}33;
                border: 1px solid ${riskColor};
                animation: pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>`
            : ''
        }
        <!-- Core Diamond Marker -->
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: ${riskColor};
          border: 2px solid #ffffff;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-family: 'Inter', system-ui, sans-serif;
          font-weight: 800;
          font-size: 10px;
          letter-spacing: -0.02em;
        ">
          ${count > 0 ? count : '•'}
        </div>
        ${
          hasVerified
            ? `<div style="
                position: absolute;
                top: -3px;
                right: -3px;
                background: #10b981;
                border: 1.5px solid #ffffff;
                border-radius: 50%;
                width: 12px;
                height: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 7px;
                color: #ffffff;
                font-weight: 900;
                box-shadow: 0 1px 3px rgba(0,0,0,0.4);
              ">✓</div>`
            : ''
        }
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/**
 * Creates custom cluster badge showing SurveyFrame count with risk-aware coloring.
 */
function createCustomClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const childMarkers = cluster.getAllChildMarkers();
  const frameCount = childMarkers.length;

  let totalAnomalies = 0;
  let hasCritical = false;
  let hasHigh = false;
  let hasVerified = false;

  childMarkers.forEach((m: any) => {
    const f: SurveyFrame = m.frameData;
    if (f) {
      totalAnomalies += f.anomalyCount;
      if (f.highestRisk === 'CRITICAL') hasCritical = true;
      if (f.highestRisk === 'HIGH') hasHigh = true;
      if (f.expertVerified) hasVerified = true;
    }
  });

  const clusterColor = hasCritical ? '#ef4444' : hasHigh ? '#f97316' : '#0284c7';
  const size = frameCount >= 50 ? 46 : frameCount >= 15 ? 40 : frameCount >= 5 ? 34 : 30;
  const fontSize = frameCount >= 100 ? 10 : 12;

  return L.divIcon({
    className: 'aqua-survey-cluster',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: ${clusterColor}33;
          border: 1.5px solid ${clusterColor};
          animation: pulse 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${clusterColor};
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-family: 'Inter', system-ui, sans-serif;
          font-weight: 800;
          line-height: 1;
        ">
          <span style="font-size: ${fontSize}px;">${frameCount}</span>
        </div>
        ${
          hasVerified
            ? `<div style="
                position: absolute;
                top: -2px;
                right: -2px;
                background: #10b981;
                border: 1.5px solid #ffffff;
                border-radius: 50%;
                width: 13px;
                height: 13px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 7px;
                color: #ffffff;
                font-weight: 900;
                box-shadow: 0 1px 3px rgba(0,0,0,0.4);
              ">✓</div>`
            : ''
        }
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Creates HTML for a SurveyFrame marker popup.
 */
function createFramePopupHtml(frame: SurveyFrame): string {
  const riskColor = RISK_COLORS[frame.highestRisk] ?? '#0284c7';
  const classEntries = Object.entries(frame.classSummary);
  const classBreakdownHtml = classEntries.length > 0
    ? classEntries
        .map(([cls, cnt]) => `
          <span style="
            display: inline-block;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 700;
            color: #334155;
            margin: 2px 2px 0 0;
          ">
            ${cnt}× ${CLASS_LABELS[cls] ?? cls}
          </span>
        `)
        .join('')
    : '<span style="font-size: 10px; color: #94a3b8;">No anomalies detected</span>';

  return `
    <div style="
      font-family: 'Inter', system-ui, sans-serif;
      min-width: 220px;
      max-width: 280px;
      padding: 4px;
    ">
      <!-- Thumbnail preview -->
      ${
        frame.thumbnail_url
          ? `<div style="
              width: 100%;
              height: 110px;
              border-radius: 6px;
              overflow: hidden;
              background: #0f172a;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <img src="${frame.thumbnail_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${frame.filename}" />
            </div>`
          : ''
      }

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">
          SURVEY FRAME
        </span>
        <span style="
          font-size: 9px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 4px;
          background: ${riskColor}18;
          color: ${riskColor};
          border: 1px solid ${riskColor}44;
        ">
          ${frame.highestRisk}
        </span>
      </div>

      <div style="font-size: 12px; font-weight: 800; color: #0f172a; word-break: break-all; margin-bottom: 4px;">
        ${frame.filename}
      </div>

      <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">
        GPS: ${frame.geolocation ? `${frame.geolocation.lat.toFixed(5)}°, ${frame.geolocation.lon.toFixed(5)}°` : 'N/A'}
      </div>

      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 11px;">
        <span>Anomalies: <strong>${frame.anomalyCount}</strong></span>
        <span>Max Conf: <strong>${Math.round(frame.highestConfidence * 100)}%</strong></span>
        ${frame.expertVerified ? '<span style="color: #15803d; font-weight: 700;">✓ Verified</span>' : ''}
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-bottom: 2px;">TARGET BREAKDOWN:</div>
        <div>${classBreakdownHtml}</div>
      </div>

      <button
        id="btn-inspect-frame-${frame.id}"
        style="
          width: 100%;
          padding: 6px 10px;
          border-radius: 6px;
          background: #0f172a;
          color: #ffffff;
          border: none;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
        "
      >
        Inspect Frame (${frame.anomalyCount} Targets)
      </button>
    </div>
  `;
}

/**
 * Leaflet MarkerClusterGroup wrapper with animated spiderfying for co-located SurveyFrames.
 */
export function MarkerClusterGroup({
  frames,
  onSelectFrame,
  onSelectCluster,
}: MarkerClusterGroupProps) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    // Initialize cluster group with smooth animated splitting and spiderfying
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 65,
      spiderfyDistanceMultiplier: 1.5,
      animateAddingMarkers: true,
      iconCreateFunction: createCustomClusterIcon,
    });

    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    // Cluster click event -> build ClusterInfo and notify
    clusterGroup.on('clusterclick', (e: any) => {
      const cluster: L.MarkerCluster = e.layer;
      const childMarkers = cluster.getAllChildMarkers();
      const constituentFrames: SurveyFrame[] = childMarkers.map((m: any) => m.frameData).filter(Boolean);

      const bounds = cluster.getBounds();
      const center = cluster.getLatLng();

      let highestRisk: HazardRisk = 'LOW';
      const riskCounts: Record<HazardRisk, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      const classCounts: Record<string, number> = {};
      let totalAnomalies = 0;
      let expertVerifiedCount = 0;

      constituentFrames.forEach((f) => {
        totalAnomalies += f.anomalyCount;
        if (f.highestRisk === 'CRITICAL') highestRisk = 'CRITICAL';
        else if (f.highestRisk === 'HIGH' && highestRisk !== 'CRITICAL') highestRisk = 'HIGH';
        else if (f.highestRisk === 'MEDIUM' && highestRisk === 'LOW') highestRisk = 'MEDIUM';

        Object.entries(f.riskSummary).forEach(([r, cnt]) => {
          riskCounts[r as HazardRisk] = (riskCounts[r as HazardRisk] || 0) + cnt;
        });
        Object.entries(f.classSummary).forEach(([c, cnt]) => {
          classCounts[c] = (classCounts[c] || 0) + cnt;
        });
        if (f.expertVerified) expertVerifiedCount++;
      });

      const clusterInfo: ClusterInfo = {
        id: `cluster_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}_${constituentFrames.length}`,
        center: { lat: center.lat, lon: center.lng },
        bounds: {
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLon: bounds.getWest(),
          maxLon: bounds.getEast(),
        },
        count: constituentFrames.length,
        frameCount: constituentFrames.length,
        totalAnomalyCount: totalAnomalies,
        densityTier: constituentFrames.length >= 15 ? 'HIGH' : constituentFrames.length >= 8 ? 'MEDIUM' : constituentFrames.length >= 4 ? 'LOW' : 'SPARSE',
        frames: constituentFrames,
        detections: constituentFrames.flatMap((f) => f.detections),
        highestRisk,
        riskCounts,
        classCounts,
        expertVerifiedCount,
      };

      onSelectCluster(clusterInfo);
    });

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map, onSelectCluster]);

  // Update markers incrementally when frames list updates
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();

    const markers: L.Marker[] = [];

    frames.forEach((frame) => {
      if (!frame.geolocation) return;

      const marker = L.marker([frame.geolocation.lat, frame.geolocation.lon], {
        icon: createFrameMarkerIcon(frame),
      });

      (marker as any).frameData = frame;

      // Popup
      const popupContent = createFramePopupHtml(frame);
      marker.bindPopup(popupContent, { maxWidth: 300 });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-inspect-frame-${frame.id}`);
        if (btn) {
          btn.onclick = (ev) => {
            ev.preventDefault();
            marker.closePopup();
            onSelectFrame(frame);
          };
        }
      });

      marker.on('click', () => {
        onSelectFrame(frame);
      });

      markers.push(marker);
    });

    clusterGroup.addLayers(markers);
  }, [frames, onSelectFrame]);

  return null;
}
