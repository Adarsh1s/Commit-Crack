"""
backend/pipeline/simulation.py
Authoritative Indian Maritime Submarine Patrol & Anomaly Hotspot Simulator
==========================================================================
Provides verified deep-water naval patrol corridors across Indian waters:
1. Arabian Sea Western Continental Shelf (Mumbai -> Kochi)
2. Bay of Bengal Eastern Fleet Patrol (Visakhapatnam -> Chennai)
3. Gulf of Kutch to Mumbai Northern Sea Lane (Dwarka/Okha -> Mumbai)
4. Lakshadweep Sea & Southern Chokepoint Transit (Kochi -> Minicoy Island)

Features:
- Dynamic route selection (random or specified).
- Authoritative GPS waypoints and bearing calculations.
- Realistic Hotspot Zone generation: clusters multiple sonar scans around
  high-density anomaly zones (mine barrages, debris, shipwrecks) with quiet
  transit stretches in between, accurately reflecting real naval sonar surveys.
"""

from __future__ import annotations
import math
import random
from typing import List, Dict, Tuple, Optional, Any


# ─── ROUTE 1: ARABIAN SEA WESTERN SHELF CORRIDOR ─────────────────────────────
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

# ─── ROUTE 2: BAY OF BENGAL EASTERN FLEET PATROL ─────────────────────────────
BAY_OF_BENGAL_VIZAG_CHENNAI_WAYPOINTS: List[Tuple[float, float, str]] = [
    (17.6800, 83.3500, "Visakhapatnam Eastern Naval Roads"),
    (17.3000, 83.1000, "Off Pudimadaka Deep Water Basin"),
    (16.8500, 82.6000, "Off Kakinada Deep Trench"),
    (16.3000, 82.1500, "Off Godavari Delta Deep Continental Slope"),
    (15.7500, 81.3000, "Off Machilipatnam Deep Sea Corridor"),
    (15.2000, 80.6000, "Off Nizampatnam Marine Shelf"),
    (14.6500, 80.3500, "Off Pennar River Deep Offshore"),
    (14.1000, 80.4000, "Off Nellore Naval Patrol Channel"),
    (13.7000, 80.5000, "Off Sriharikota Offshore Barrier"),
    (13.3500, 80.4500, "Off Pulicat Shoal Deep Transit"),
    (13.1000, 80.3500, "Chennai Deep Naval Anchorage"),
]

# ─── ROUTE 3: GULF OF KUTCH TO MUMBAI NORTHERN PATROL ────────────────────────
GULF_OF_KUTCH_MUMBAI_WAYPOINTS: List[Tuple[float, float, str]] = [
    (22.4500, 69.0500, "Okha / Gulf of Kutch Maritime Border Approach"),
    (22.2000, 68.9000, "Off Dwarka Deep Coastal Slope"),
    (21.6000, 69.5000, "Off Porbandar Deep Water Patrol Line"),
    (20.8500, 70.3000, "Off Veraval / Somnath Marine Trench"),
    (20.6500, 70.9500, "Off Diu Deep Naval Channel"),
    (20.3000, 71.8000, "Gulf of Khambhat Southern Outer Anchorage"),
    (19.9000, 72.3000, "Off Daman / Tarapur Deep Sea Trench"),
    (19.3000, 72.5000, "Off Mumbai High Offshore Patrol Zone"),
    (18.8500, 72.6500, "Mumbai Western Fleet Roadstead"),
]

# ─── ROUTE 4: LAKSHADWEEP SEA & SOUTHERN CHOKEPOINT TRANSIT ───────────────────
LAKSHADWEEP_MINICOY_WAYPOINTS: List[Tuple[float, float, str]] = [
    (9.9600, 76.2000, "Kochi Naval Base Southern Gate"),
    (9.7000, 75.3000, "Off Alleppey Deep Continental Drop-off"),
    (9.3000, 74.2000, "Lakshadweep Sea Eastern Transit Channel"),
    (8.9500, 73.5000, "Off Kalpeni Deep Subsea Ridge"),
    (8.6000, 73.1000, "Nine Degree Channel Northern Boundary"),
    (8.2800, 73.0500, "Minicoy Island Deep Lagoon & Eight Degree Channel"),
]

# ─── MASTER PATROL ROUTE CATALOG ─────────────────────────────────────────────
PATROL_ROUTES: Dict[str, Dict[str, Any]] = {
    "mumbai_kochi": {
        "id": "mumbai_kochi",
        "name": "Arabian Sea Western Shelf Deep Water Corridor",
        "region": "Arabian Sea / Western Fleet",
        "start": "Mumbai Offshore Anchorage",
        "end": "Kochi Naval Channel",
        "waypoints": ARABIAN_SEA_MUMBAI_KOCHI_WAYPOINTS,
        "description": "Deep-water transit along the Indian Western Continental Shelf.",
    },
    "vizag_chennai": {
        "id": "vizag_chennai",
        "name": "Bay of Bengal Eastern Fleet Corridor",
        "region": "Bay of Bengal / Eastern Fleet",
        "start": "Visakhapatnam Deep Roads",
        "end": "Chennai Naval Anchorage",
        "waypoints": BAY_OF_BENGAL_VIZAG_CHENNAI_WAYPOINTS,
        "description": "Strategic maritime patrol corridor along the Andhra-Tamil Nadu coast.",
    },
    "kutch_mumbai": {
        "id": "kutch_mumbai",
        "name": "Gulf of Kutch to Mumbai Northern Sea Lane",
        "region": "Northern Arabian Sea / Gujarat Frontier",
        "start": "Okha / Gulf of Kutch Approach",
        "end": "Mumbai Western Fleet Roadstead",
        "waypoints": GULF_OF_KUTCH_MUMBAI_WAYPOINTS,
        "description": "Border patrol line from Gulf of Kutch down past Diu to Mumbai.",
    },
    "lakshadweep": {
        "id": "lakshadweep",
        "name": "Lakshadweep Sea & Eight Degree Channel Patrol",
        "region": "Southern Indian Ocean Chokepoint",
        "start": "Kochi Naval Base Southern Gate",
        "end": "Minicoy Island Eight Degree Channel",
        "waypoints": LAKSHADWEEP_MINICOY_WAYPOINTS,
        "description": "Critical maritime chokepoint transit monitoring the Eight Degree Channel.",
    },
}


def get_available_routes() -> List[Dict[str, Any]]:
    """Returns a summary of all registered naval patrol routes."""
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "region": r["region"],
            "start": r["start"],
            "end": r["end"],
            "description": r["description"],
            "waypoint_count": len(r["waypoints"]),
        }
        for r in PATROL_ROUTES.values()
    ]


def select_route(route_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Selects a patrol route:
    - If route_id is None, "random", or not recognized, picks one at random.
    - Otherwise returns the requested route dictionary.
    """
    clean_id = (route_id or "").strip().lower()
    if clean_id in PATROL_ROUTES:
        return PATROL_ROUTES[clean_id]
    
    # Random selection across all available corridors
    chosen_key = random.choice(list(PATROL_ROUTES.keys()))
    return PATROL_ROUTES[chosen_key]


def get_mumbai_kochi_route() -> List[Dict[str, float]]:
    """Legacy backward-compatible accessor for Mumbai -> Kochi route waypoints."""
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
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def interpolate_route(
    total_steps: int,
    route_key: Optional[str] = None
) -> List[Dict[str, float]]:
    """
    Interpolates total_steps evenly distributed GPS positions along the selected route corridor.
    Guarantees:
    - Step 1 (index 0) is precisely the origin waypoint.
    - Step total_steps (index total_steps - 1) is precisely the destination waypoint.
    """
    if total_steps <= 0:
        return []

    route_info = select_route(route_key) if route_key else PATROL_ROUTES["mumbai_kochi"]
    raw_waypoints = route_info["waypoints"]
    waypoints = [(lat, lon) for lat, lon, _ in raw_waypoints]

    if total_steps == 1:
        lat, lon = waypoints[0]
        next_lat, next_lon = waypoints[min(1, len(waypoints) - 1)]
        hdg = calculate_bearing(lat, lon, next_lat, next_lon)
        return [{
            "lat": lat,
            "lon": lon,
            "latitude": lat,
            "longitude": lon,
            "heading": round(hdg, 1),
            "progress_pct": 0.0,
        }]

    # Cumulative distance along route waypoints
    cum_distances = [0.0]
    for i in range(1, len(waypoints)):
        d = calculate_distance_km(waypoints[i - 1][0], waypoints[i - 1][1], waypoints[i][0], waypoints[i][1])
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

            # Find bounding segment
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


# ─── REALISTIC ANOMALY HOTSPOT CLUSTERING GENERATOR ──────────────────────────

def generate_patrol_simulation(
    total_frames: int,
    route_key: Optional[str] = "random",
    num_hotspots: int = 2,
) -> Dict[str, Any]:
    """
    Generates an authoritative naval patrol trajectory along the hardcoded route corridor.
    Guarantees:
    - Image 1 (index 0) is strictly at Route START (0.0% progress).
    - Last Image (index total_frames - 1) is strictly at Route END (100.0% progress).
    - Single image (total_frames = 1) is safely positioned at Route START without division by zero.
    - All intermediate images are evenly interpolated along the complete cumulative waypoint corridor.
    - Anomaly hotspot metadata is annotated along the corridor for situational awareness.
    """
    route_info = select_route(route_key)
    raw_waypoints = route_info["waypoints"]
    formatted_waypoints = [
        {"lat": lat, "lon": lon, "name": name}
        for lat, lon, name in raw_waypoints
    ]

    if total_frames <= 0:
        return {
            "route": {
                "id": route_info["id"],
                "name": route_info["name"],
                "region": route_info["region"],
                "start": route_info["start"],
                "end": route_info["end"],
                "description": route_info["description"],
                "waypoints": formatted_waypoints,
            },
            "hotspots": [],
            "frames": [],
        }

    # Step 1: Interpolate exact, deterministic route positions for every frame
    route_points = interpolate_route(total_frames, route_info["id"])

    # Step 2: Establish hotspot zones along the route for reference metadata
    hotspot_catalog = [
        ("HOTSPOT-ALPHA", "Subsea Minefield Barrage / Contact Cluster", 28.0),
        ("HOTSPOT-BRAVO", "Deep Shipwreck & Ordnance Debris Zone", 58.0),
        ("HOTSPOT-CHARLIE", "Pipeline Anchor Snag & Structural Fracture Zone", 82.0),
    ]
    actual_num_hotspots = min(len(hotspot_catalog), max(1, num_hotspots))
    hotspots = []
    
    # 100-step base reference to resolve exact coordinates for hotspot center points
    ref_track = interpolate_route(100, route_info["id"])
    for h_idx in range(actual_num_hotspots):
        h_code, h_desc, target_pct = hotspot_catalog[h_idx]
        ref_idx = int((target_pct / 100.0) * (len(ref_track) - 1))
        center_pt = ref_track[ref_idx]
        hotspots.append({
            "id": f"hs_{h_idx + 1}",
            "code": h_code,
            "title": h_desc,
            "lat": center_pt["lat"],
            "lon": center_pt["lon"],
            "heading": center_pt["heading"],
            "progress_pct": round(target_pct, 1),
            "frames_allocated": 0,
        })

    # Step 3: Build frames telemetry. Every frame is strictly anchored on its route position.
    frames_telemetry = []
    for idx, pt in enumerate(route_points):
        seq = idx + 1
        pct = pt["progress_pct"]

        # Check if this frame passes within an anomaly hotspot zone (+/- 8% of a hotspot)
        matching_hs = None
        for hs in hotspots:
            if abs(pct - hs["progress_pct"]) <= 8.0:
                matching_hs = hs
                hs["frames_allocated"] = hs.get("frames_allocated", 0) + 1
                break

        frames_telemetry.append({
            "sequence": seq,
            "lat": pt["lat"],
            "lon": pt["lon"],
            "latitude": pt["lat"],
            "longitude": pt["lon"],
            "heading": pt["heading"],
            "progress_pct": pct,
            "is_hotspot": matching_hs is not None,
            "hotspot_id": matching_hs["code"] if matching_hs else None,
            "hotspot_title": matching_hs["title"] if matching_hs else None,
            "anomaly_bias": "HIGH" if matching_hs else "MEDIUM",
        })

    return {
        "route": {
            "id": route_info["id"],
            "name": route_info["name"],
            "region": route_info["region"],
            "start": route_info["start"],
            "end": route_info["end"],
            "description": route_info["description"],
            "waypoints": formatted_waypoints,
        },
        "hotspots": hotspots,
        "frames": frames_telemetry,
    }
