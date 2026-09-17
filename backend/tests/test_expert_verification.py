"""
backend/tests/test_expert_verification.py
Unit tests verifying Expert Verification logic, confidence boundaries, and model schema compatibility.
"""
import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from models import Detection, DetectionDimensions, GeoCoordinate


def is_high_risk(hazard: str) -> bool:
    return hazard in ("HIGH", "CRITICAL")


def should_show_high_risk_alert(hazard: str, confidence: float) -> bool:
    return is_high_risk(hazard) and confidence > 0.75


def is_verification_eligible(hazard: str, confidence: float) -> bool:
    return is_high_risk(hazard) and (0.35 < confidence < 0.75)


class TestExpertVerificationRules(unittest.TestCase):

    def test_high_confidence_greater_than_75(self):
        """HIGH/CRITICAL with confidence > 75% -> Alert = True, Verification = False"""
        self.assertTrue(should_show_high_risk_alert("HIGH", 0.80))
        self.assertTrue(should_show_high_risk_alert("CRITICAL", 0.95))
        self.assertFalse(is_verification_eligible("HIGH", 0.80))
        self.assertFalse(is_verification_eligible("CRITICAL", 0.95))

    def test_high_confidence_equal_75(self):
        """HIGH/CRITICAL with confidence == 75% -> Excluded from both"""
        self.assertFalse(should_show_high_risk_alert("HIGH", 0.75))
        self.assertFalse(should_show_high_risk_alert("CRITICAL", 0.75))
        self.assertFalse(is_verification_eligible("HIGH", 0.75))
        self.assertFalse(is_verification_eligible("CRITICAL", 0.75))

    def test_high_confidence_between_35_and_75(self):
        """HIGH/CRITICAL with 35% < confidence < 75% -> Verification = True, Alert = False"""
        for conf in [0.36, 0.50, 0.65, 0.74]:
            self.assertTrue(is_verification_eligible("HIGH", conf), f"Failed for HIGH at {conf}")
            self.assertTrue(is_verification_eligible("CRITICAL", conf), f"Failed for CRITICAL at {conf}")
            self.assertFalse(should_show_high_risk_alert("HIGH", conf))
            self.assertFalse(should_show_high_risk_alert("CRITICAL", conf))

    def test_confidence_equal_35(self):
        """HIGH/CRITICAL with confidence == 35% -> Excluded from verification"""
        self.assertFalse(is_verification_eligible("HIGH", 0.35))
        self.assertFalse(is_verification_eligible("CRITICAL", 0.35))
        self.assertFalse(should_show_high_risk_alert("HIGH", 0.35))

    def test_confidence_less_than_35(self):
        """HIGH/CRITICAL with confidence < 35% -> No verification"""
        self.assertFalse(is_verification_eligible("HIGH", 0.20))
        self.assertFalse(is_verification_eligible("CRITICAL", 0.20))
        self.assertFalse(should_show_high_risk_alert("HIGH", 0.20))

    def test_low_and_medium_never_show_verification(self):
        """LOW and MEDIUM hazard levels must never trigger verification or alert"""
        for conf in [0.40, 0.50, 0.60, 0.70, 0.85]:
            self.assertFalse(is_verification_eligible("LOW", conf))
            self.assertFalse(is_verification_eligible("MEDIUM", conf))
            self.assertFalse(should_show_high_risk_alert("LOW", conf))
            self.assertFalse(should_show_high_risk_alert("MEDIUM", conf))

    def test_detection_model_compatibility(self):
        """Ensure Pydantic Detection model supports expert_status and expert_verified"""
        det = Detection(
            id="test-001",
            target_class="mine_cylinder",
            confidence=0.65,
            shadow_evidence="SUPPORTING",
            dimensions=DetectionDimensions(length_m=1.8, width_m=0.6, area_m2=1.08, relief_height_m=0.5),
            geolocation=GeoCoordinate(lat=18.9, lon=72.8),
            local_offset=None,
            hazard_risk="CRITICAL",
            bounding_box=(10.0, 20.0, 100.0, 120.0),
            mask_contour=[(10.0, 20.0), (100.0, 120.0)],
            thumbnail_base64="data:image/jpeg;base64,abc",
            expert_status="CONFIRMED",
            expert_verified=True,
        )
        self.assertEqual(det.expert_status, "CONFIRMED")
        self.assertTrue(det.expert_verified)

    def test_geolocation_projection_fallback(self):
        """Ensure geolocation projection computes valid coordinates for mission corridor"""
        from pipeline.geolocation import project_detection_geolocation
        detection = {"x_min": 100, "x_max": 200, "y_min": 150, "y_max": 250}
        geo, local_off = project_detection_geolocation(
            detection=detection,
            img_width=640,
            img_height=640,
            vessel_lat=15.2993,
            vessel_lon=73.7240,
            swath_width_m=60.0
        )
        self.assertIsNotNone(geo)
        self.assertIn("lat", geo)
        self.assertIn("lon", geo)
        self.assertAlmostEqual(geo["lat"], 15.2993, places=2)
        self.assertAlmostEqual(geo["lon"], 73.7240, places=2)


if __name__ == "__main__":
    unittest.main()
