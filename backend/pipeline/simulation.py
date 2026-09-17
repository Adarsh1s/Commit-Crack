"""
backend/pipeline/simulation.py
Authoritative Arabian Sea Submarine Route & GPS Telemetry Simulator
===================================================================
Provides verified deep-water maritime route waypoints along the Indian Western
Continental Shelf (offshore Arabian Sea) from Mumbai Naval Anchorage to Kochi Roadstead.
Used as the authoritative simulation telemetry source for test_run.py and backend/frontend.
"""

from __future__ import annotations
import math
from typing import List, Dict, Tuple, Optional


# Verified Deep Arabian Sea Offshore Maritime Corridor (Off the coastline in open sea)
ARABIAN_SEA_MUMBAI_KOCHI_WAYPOINTS: List[Tuple[float, float, str]] = [
    (18.8000, 72.6000, "Mumbai Deep Offshore Anchorage"),
    (18.2500, 72.7500, "Off Murud / Janjira Deep Sea"),
    (17.6500, 72.9000, "Off Dabhol Continental Shelf"),
    (16.9500, 73.0500, "Off Ratnagiri Marine Channel"),
    (16.4500, 73.2000, "Off Vijaydurg Marine Corridor"),
    (16.0000, 73.3000, "Off Malvan / Vengurla Shelf"),
    (15.3500, 73.5500, "Off Goa (Mormugao Deep Sea Transit)"),
    (14.7500, 73.9000, "Off Karwar Naval Route"),
    (14.3000, 74.1000, "Off Kumta Deep Sea"),
    (13.9500, 74.3000, "Off Bhatkal Deep Water"),
    (13.5000, 74.4500, "Off Kundapura Marine Trench"),
    (13.3000, 74.5000, "Off Udupi / Malpe Offshore"),
    (12.8000, 74.6000, "Off Mangalore Sea Corridor"),
    (12.4500, 74.7500, "Off Kasaragod Open Sea"),
    (11.8000, 75.1000, "Off Kannur Deep Water"),
    (11.2000, 75.5000, "Off Kozhikode (Calicut) Offshore"),
    (10.7500, 75.7000, "Off Ponnani Marine Channel"),
    (10.2500, 75.9000, "Off Thrissur Deep Water"),
    (10.0000, 76.0000, "Off Kochi Approach Channel"),
    (9.9600, 76.2000, "Kochi Roadstead / Naval Channel"),
]


def get_mumbai_kochi_route() -> List[Dict[str, float]]:
    """
    Returns the complete list of canonical Arabian Sea waypoint coordinates.
    Format: [{"lat": float, "lon": float}, ...]
    """
    return [{"lat": lat, "lon": lon} for lat, lon, _ in ARABIAN_SEA_MUMBAI_KOCHI_WAYPOINTS]


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate forward true bearing in degrees between two GPS coordinates."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Haversine distance in km between two GPS coordinates."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def interpolate_route(total_steps: int) -> List[Dict[str, float]]:
    """
    Interpolates total_steps evenly distributed GPS positions along the Arabian Sea Mumbai -> Kochi corridor.
    Guarantees:
    - Step 1 (index 0) is precisely the Mumbai starting waypoint (18.8000, 72.6000)
    - Step total_steps (index total_steps - 1) is precisely the Kochi final waypoint (9.9600, 76.2000)
    """
    if total_steps <= 0:
        return []
    
    waypoints = [(lat, lon) for lat, lon, _ in ARABIAN_SEA_MUMBAI_KOCHI_WAYPOINTS]
    if total_steps == 1:
        lat, lon = waypoints[0]
        return [{
            "lat": lat,
            "lon": lon,
            "latitude": lat,
            "longitude": lon,
            "heading": 180.0,
            "progress_pct": 0.0,
        }]
    
    # Calculate cumulative distance along waypoints
    cum_distances = [0.0]
    for i in range(1, len(waypoints)):
        d = calculate_distance_km(waypoints[i-1][0], waypoints[i-1][1], waypoints[i][0], waypoints[i][1])
        cum_distances.append(cum_distances[-1] + d)
    
    total_distance = cum_distances[-1]
    
    interpolated = []
    for step in range(total_steps):
        if step == 0:
            lat, lon = waypoints[0]
            next_lat, next_lon = waypoints[1]
            hdg = calculate_bearing(lat, lon, next_lat, next_lon)
            progress_pct = 0.0
        elif step == total_steps - 1:
            lat, lon = waypoints[-1]
            prev_lat, prev_lon = waypoints[-2]
            hdg = calculate_bearing(prev_lat, prev_lon, lat, lon)
            progress_pct = 100.0
        else:
            target_dist = (step / (total_steps - 1)) * total_distance
            
            # Find segment
            seg_idx = 0
            while seg_idx < len(cum_distances) - 1 and cum_distances[seg_idx + 1] < target_dist:
                seg_idx += 1
                
            if seg_idx >= len(waypoints) - 1:
                lat, lon = waypoints[-1]
                prev_lat, prev_lon = waypoints[-2]
                hdg = calculate_bearing(prev_lat, prev_lon, lat, lon)
            else:
                seg_len = cum_distances[seg_idx + 1] - cum_distances[seg_idx]
                ratio = (target_dist - cum_distances[seg_idx]) / max(0.0001, seg_len)
                ratio = max(0.0, min(1.0, ratio))
                
                p1 = waypoints[seg_idx]
                p2 = waypoints[seg_idx + 1]
                
                lat = p1[0] + (p2[0] - p1[0]) * ratio
                lon = p1[1] + (p2[1] - p1[1]) * ratio
                hdg = calculate_bearing(p1[0], p1[1], p2[0], p2[1])
                
            progress_pct = round((step / (total_steps - 1)) * 100.0, 1)

        interpolated.append({
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "heading": round(hdg, 1),
            "progress_pct": progress_pct,
        })
        
    return interpolated
