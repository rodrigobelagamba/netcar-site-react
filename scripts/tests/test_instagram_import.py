import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

SPEC = importlib.util.spec_from_file_location("instagram_import", Path(__file__).resolve().parents[1] / "import-instagram-deliveries.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class InstagramImportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.photo = self.root / "photo.jpg"
        Image.new("RGB", (1080, 1920), "navy").save(self.photo)
        self.entry = {
            "highlightTitle": "CLIENTES XIV",
            "highlightUrl": "https://www.instagram.com/stories/highlights/123/",
            "publishedAt": "2026-06-22T23:30:00-03:00",
            "imagePath": str(self.photo),
            "sourceAssetName": "729869197_18543836632077982_7135951246503410341_n.jpg",
        }
        self.index = self.root / MODULE.INDEX_RELATIVE
        self.manifest = self.root / "batch.json"

    def run_import(self, entries):
        self.manifest.write_text(json.dumps(entries))
        return MODULE.import_manifests([self.manifest], self.root)

    def read_index(self):
        return json.loads(self.index.read_text())

    def test_variants_publication_day_and_repeat_preserve_edited_names(self):
        marker = self.root / "public/entregas-media/marketing.webp"
        marker.parent.mkdir(parents=True)
        marker.write_bytes(b"existing marketing file")
        self.assertEqual(self.run_import([self.entry])["imported"], 1)
        index = self.read_index()
        record = index["deliveries"][0]
        self.assertEqual(record["date"], "2026-06-22")
        self.assertEqual(record["name"], "")
        for width in (320, 640, 960):
            with Image.open(self.root / MODULE.MEDIA_RELATIVE / f'{record["id"]}-{width}.webp') as photo:
                self.assertEqual(photo.width, width)
        record["name"] = "Nome confirmado manualmente"
        self.index.write_text(json.dumps(index))
        before = self.index.read_bytes()
        second = self.run_import([self.entry])
        self.assertEqual(second["imported"], 0)
        self.assertEqual(second["skippedDuplicates"], 1)
        self.assertEqual(self.index.read_bytes(), before)
        self.assertEqual(marker.read_bytes(), b"existing marketing file")

    def test_invalid_date_or_corrupt_image_cannot_partially_import_batch(self):
        bad = {**self.entry, "publishedAt": "2026-02-31"}
        with self.assertRaises(ValueError):
            self.run_import([self.entry, bad])
        self.assertFalse(self.index.exists())
        self.assertFalse((self.root / MODULE.MEDIA_RELATIVE).exists())
        corrupt = self.root / "corrupt.jpg"
        corrupt.write_bytes(b"not an image")
        with self.assertRaises(OSError):
            self.run_import([self.entry, {**self.entry, "imagePath": str(corrupt)}])
        self.assertFalse(self.index.exists())
        self.assertFalse((self.root / MODULE.MEDIA_RELATIVE).exists())

    def test_explicit_timezone_uses_netcar_month_without_shifting_date_only_values(self):
        self.assertEqual(MODULE.publication_date("2026-07-01T01:10:00Z")[1], "2026-06-30")
        self.assertEqual(MODULE.publication_date("2026-07-01T03:10:00Z")[1], "2026-07-01")
        self.assertEqual(MODULE.publication_date("2026-07-01T01:10:00")[1], "2026-07-01")
        self.assertEqual(MODULE.publication_date("2026-07-01")[1], "2026-07-01")
        self.assertGreater(MODULE.publication_sort_key({"publishedAt": "2026-06-22T17:23:27Z"}),
                           MODULE.publication_sort_key({"publishedAt": "2026-06-22T13:52:53Z"}))

    def test_source_aliases_prevent_duplicates_and_can_fill_missing_date(self):
        self.run_import([{**self.entry, "publishedAt": None}])
        self.assertIsNone(self.read_index()["deliveries"][0]["date"])
        copy = self.root / "copy.png"
        with Image.open(self.photo) as image:
            image.save(copy)
        result = self.run_import([{**self.entry, "imagePath": str(copy)}])
        self.assertEqual(result["imported"], 0)
        self.assertEqual(self.read_index()["deliveries"][0]["date"], "2026-06-22")
        again = self.run_import([{**self.entry, "imagePath": str(copy), "sourceAssetName": "generic.png"}])
        self.assertEqual(again["imported"], 0)
        self.assertEqual(again["totalInstagramPhotos"], 1)

    def test_generic_asset_names_do_not_merge_distinct_images_and_missing_media_recovers(self):
        other = self.root / "other.jpg"
        Image.new("RGB", (700, 900), "orange").save(other)
        entries = [{**self.entry, "sourceAssetName": "story.jpg"},
                   {**self.entry, "imagePath": str(other), "sourceAssetName": "story.jpg"}]
        self.assertEqual(self.run_import(entries)["imported"], 2)
        record = self.read_index()["deliveries"][0]
        missing = self.root / "public" / record["previewImageUrl"].lstrip("/")
        missing.unlink()
        result = self.run_import(entries)
        self.assertEqual(result["imported"], 0)
        self.assertEqual(result["repairedMedia"], 1)
        self.assertTrue(missing.is_file())


if __name__ == "__main__":
    unittest.main()
