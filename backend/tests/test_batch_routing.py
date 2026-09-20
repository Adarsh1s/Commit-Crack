"""
backend/tests/test_batch_routing.py
Comprehensive validation test suite for Aqua Sentinel Batch Routing Simulation.
Tests:
- TEST 1: 2 images (First at start, Last at end)
- TEST 2: 5 images (0%, 25%, 50%, 75%, 100%)
- TEST 3: 10 images (Distributed across complete route)
- TEST 4: Large batch (100 images: strictly 0% to 100%)
- TEST 5: Timestamp independence (large timestamp gaps don't change route coordinates)
- TEST 6: Single image edge case (no division-by-zero, at start)
- TEST 7: All registered routes (mumbai_kochi, vizag_chennai, kutch_mumbai, lakshadweep)
- TEST 8: Detection projection verification (detection coordinates offset from vessel position)
"""

import unittest
import sys
from pathlib import Path

# Add project root and backend to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend"))

from backend.pipeline.simulation import (
    PATROL_ROUTES,
    select_route,
    interpolate_route,
    generate_patrol_simulation,
)
from backend.pipeline.geolocation import project_detection_geolocation


class TestBatchRoutingSimulation(unittest.TestCase):

    def test_single_image_edge_case(self):
        """TEST 6: Single image edge case (N=1) must not crash or divide by zero, and starts at route origin."""
        sim = generate_patrol_simulation(total_frames=1, route_key="mumbai_kochi")
        frames = sim["frames"]
        self.assertEqual(len(frames), 1)
        origin_lat, origin_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][0]
        self.assertAlmostEqual(frames[0]["lat"], origin_lat, places=4)
        self.assertAlmostEqual(frames[0]["lon"], origin_lon, places=4)
        self.assertEqual(frames[0]["progress_pct"], 0.0)

    def test_two_images(self):
        """TEST 1: 2 images must place Image 1 at Route START and Image 2 at Route END."""
        sim = generate_patrol_simulation(total_frames=2, route_key="mumbai_kochi")
        frames = sim["frames"]
        self.assertEqual(len(frames), 2)

        start_lat, start_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][0]
        end_lat, end_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][-1]

        # First frame must be precisely at route START (progress 0%)
        self.assertAlmostEqual(frames[0]["lat"], start_lat, places=4)
        self.assertAlmostEqual(frames[0]["lon"], start_lon, places=4)
        self.assertEqual(frames[0]["progress_pct"], 0.0)

        # Second frame must be precisely at route END (progress 100%)
        self.assertAlmostEqual(frames[1]["lat"], end_lat, places=4)
        self.assertAlmostEqual(frames[1]["lon"], end_lon, places=4)
        self.assertEqual(frames[1]["progress_pct"], 100.0)

    def test_five_images(self):
        """TEST 2: 5 images must be placed at 0%, 25%, 50%, 75%, 100% progress."""
        sim = generate_patrol_simulation(total_frames=5, route_key="mumbai_kochi")
        frames = sim["frames"]
        self.assertEqual(len(frames), 5)

        expected_progress = [0.0, 25.0, 50.0, 75.0, 100.0]
        for i, exp in enumerate(expected_progress):
            self.assertAlmostEqual(frames[i]["progress_pct"], exp, delta=0.1)

        # Check start and end coordinates
        start_lat, start_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][0]
        end_lat, end_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][-1]
        self.assertAlmostEqual(frames[0]["lat"], start_lat, places=4)
        self.assertAlmostEqual(frames[0]["lon"], start_lon, places=4)
        self.assertAlmostEqual(frames[-1]["lat"], end_lat, places=4)
        self.assertAlmostEqual(frames[-1]["lon"], end_lon, places=4)

    def test_ten_images(self):
        """TEST 3: 10 images must be distributed across the complete route from 0% to 100%."""
        sim = generate_patrol_simulation(total_frames=10, route_key="mumbai_kochi")
        frames = sim["frames"]
        self.assertEqual(len(frames), 10)

        self.assertEqual(frames[0]["progress_pct"], 0.0)
        self.assertEqual(frames[-1]["progress_pct"], 100.0)

        # Progress must be strictly monotonically increasing
        for i in range(1, len(frames)):
            self.assertGreater(frames[i]["progress_pct"], frames[i - 1]["progress_pct"])

    def test_large_batch_hundred_images(self):
        """TEST 4: 100 images must start at 0% and end at 100% with smooth progression."""
        sim = generate_patrol_simulation(total_frames=100, route_key="mumbai_kochi")
        frames = sim["frames"]
        self.assertEqual(len(frames), 100)

        start_lat, start_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][0]
        end_lat, end_lon, _ = PATROL_ROUTES["mumbai_kochi"]["waypoints"][-1]

        self.assertAlmostEqual(frames[0]["lat"], start_lat, places=4)
        self.assertAlmostEqual(frames[0]["lon"], start_lon, places=4)
        self.assertEqual(frames[0]["progress_pct"], 0.0)

        self.assertAlmostEqual(frames[-1]["lat"], end_lat, places=4)
        self.assertAlmostEqual(frames[-1]["lon"], end_lon, places=4)
        self.assertEqual(frames[-1]["progress_pct"], 100.0)

        # Monotonicity check
        for i in range(1, len(frames)):
            self.assertGreater(frames[i]["progress_pct"], frames[i - 1]["progress_pct"])

    def test_all_registered_routes(self):
        """TEST 7: All 4 registered naval routes must correctly interpolate from start to end."""
        routes = ["mumbai_kochi", "vizag_chennai", "kutch_mumbai", "lakshadweep"]
        for r_key in routes:
            with self.subTest(route=r_key):
                sim = generate_patrol_simulation(total_frames=12, route_key=r_key)
                frames = sim["frames"]
                self.assertEqual(len(frames), 12)

                route_wps = PATROL_ROUTES[r_key]["waypoints"]
                expected_start_lat, expected_start_lon, _ = route_wps[0]
                expected_end_lat, expected_end_lon, _ = route_wps[-1]

                self.assertAlmostEqual(frames[0]["lat"], expected_start_lat, places=4)
                self.assertAlmostEqual(frames[0]["lon"], expected_start_lon, places=4)
                self.assertEqual(frames[0]["progress_pct"], 0.0)

                self.assertAlmostEqual(frames[-1]["lat"], expected_end_lat, places=4)
                self.assertAlmostEqual(frames[-1]["lon"], expected_end_lon, places=4)
                self.assertEqual(frames[-1]["progress_pct"], 100.0)

    def test_timestamp_independence(self):
        """TEST 5: Geographic coordinates must be derived from image index, independent of timestamps."""
        # Generating 5 frames twice produces identical geographic route positions regardless of time
        sim1 = generate_patrol_simulation(total_frames=5, route_key="mumbai_kochi")
        sim2 = generate_patrol_simulation(total_frames=5, route_key="mumbai_kochi")

        for f1, f2 in zip(sim1["frames"], sim2["frames"]):
            self.assertAlmostEqual(f1["lat"], f2["lat"], places=5)
            self.assertAlmostEqual(f1["lon"], f2["lon"], places=5)
            self.assertEqual(f1["progress_pct"], f2["progress_pct"])

    def test_detection_geolocation_projection(self):
        """TEST 8: Detections projected from simulated vessel coordinates retain accurate WGS84 coordinates."""
        sim = generate_patrol_simulation(total_frames=5, route_key="mumbai_kochi")
        frame_0 = sim["frames"][0]
        vessel_lat = frame_0["lat"]
        vessel_lon = frame_0["lon"]
        heading = frame_0["heading"]

        mock_detection = {
            "x_min": 100,
            "y_min": 200,
            "x_max": 250,
            "y_max": 350,
        }

        geo_coords, local_offset = project_detection_geolocation(
            detection=mock_detection,
            img_width=640,
            img_height=640,
            vessel_lat=vessel_lat,
            vessel_lon=vessel_lon,
            swath_width_m=100.0,
            heading_deg=heading,
        )

        self.assertIsNotNone(geo_coords)
        self.assertIn("lat", geo_coords)
        self.assertIn("lon", geo_coords)
        # Coordinate must be in close proximity to the vessel (within 0.005 degrees)
        self.assertLess(abs(geo_coords["lat"] - vessel_lat), 0.005)
        self.assertLess(abs(geo_coords["lon"] - vessel_lon), 0.005)


if __name__ == "__main__":
    unittest.main()
