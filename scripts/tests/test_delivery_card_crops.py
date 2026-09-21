import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-delivery-card-crops.py"
SPEC = importlib.util.spec_from_file_location("delivery_crops", SCRIPT)
crops = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(crops)


def face(x, y, width=.08, height=.045, confidence=.75):
    return {"x": x, "y": y, "width": width, "height": height,
            "confidence": confidence}


class DeliveryCropTests(unittest.TestCase):
    def crop(self, faces, width=1080, height=1920):
        return crops.crop_for_detection({"width": width, "height": height, "faces": faces})

    def test_group_and_shoulders_fit_in_square_with_zoom_limit(self):
        faces = [face(.12, .28), face(.42, .26), face(.64, .30)]
        crop, reason = self.crop(faces)
        self.assertEqual(reason, "crop")
        x, y, width, height = crop
        self.assertAlmostEqual(width * 1080, height * 1920, delta=.003)
        self.assertGreaterEqual(width, 1 / crops.MAX_ZOOM - .000001)
        for item in faces:
            self.assertLessEqual(x, max(0, item["x"] - item["width"] * .7) + .000001)
            self.assertGreaterEqual(x + width, min(1, item["x"] + item["width"] * 1.7) - .000001)
            self.assertLessEqual(y, max(0, item["y"] - item["height"] * .6) + .000001)
            self.assertGreaterEqual(y + height, min(1, item["y"] + item["height"] * 3.1) - .000001)

    def test_right_edge_group_is_not_recentred_away_from_people(self):
        faces = [face(.67, .30, width=.06), face(.92, .27, width=.07)]
        crop, reason = self.crop(faces)
        self.assertEqual(reason, "crop")
        self.assertAlmostEqual(crop[0] + crop[2], 1, delta=.000001)
        self.assertGreater(crop[0], .4)

    def test_weak_face_does_not_get_dropped_in_favor_of_stronger_face(self):
        crop, reason = self.crop([face(.1, .3), face(.7, .3, confidence=.4)])
        self.assertIsNone(crop)
        self.assertEqual(reason, "uncertain_detection")

    def test_distant_group_falls_back_instead_of_cutting_someone(self):
        crop, reason = self.crop([face(.3, .1), face(.3, .8)])
        self.assertIsNone(crop)
        self.assertEqual(reason, "group_needs_full_photo")

    def test_no_detection_keeps_fallback(self):
        crop, reason = self.crop([])
        self.assertIsNone(crop)
        self.assertEqual(reason, "no_detection")

    def test_tiny_faces_keep_fallback(self):
        crop, reason = self.crop([face(.3, .3, width=.005, height=.004)])
        self.assertIsNone(crop)
        self.assertEqual(reason, "tiny_detection")


if __name__ == "__main__":
    unittest.main()
