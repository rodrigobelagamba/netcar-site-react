#!/usr/bin/env python3
"""Generate card crop geometry locally with macOS Vision; never change images.

Run: python3 scripts/prepare-delivery-card-crops.py
Requires only macOS, Apple Command Line Tools, and Python standard library.
Output values are normalized [left, top, width, height] in original image space.
Only source image paths already present under public/entregas-media are read.
Missing/uncertain detections are omitted for the UI's conservative fallback.
No face recognition, embeddings, customer names, or external service is used.
"""

import argparse
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/modules/entregas/data"
OUTPUT = DATA / "delivery-card-crops.json"
DETECTOR = ROOT / "scripts/detect-delivery-faces.swift"
MAX_ZOOM = 1.75
MIN_CONFIDENCE = 0.50


def crop_for_detection(detection):
    """Return a square that contains every detected face plus head/shoulders."""
    width, height = detection.get("width", 0), detection.get("height", 0)
    faces = detection.get("faces", [])
    if detection.get("error") or not width or not height or not faces:
        return None, "no_detection"
    # Do not crop around a strong face while silently excluding a weaker one.
    if any(face.get("confidence", 0) < MIN_CONFIDENCE for face in faces):
        return None, "uncertain_detection"
    if any(min(face["width"] * width, face["height"] * height) < 12 for face in faces):
        return None, "tiny_detection"
    boxes = [
        (face["x"] * width, face["y"] * height,
         face["width"] * width, face["height"] * height)
        for face in faces
    ]
    # Per-person padding keeps larger/closer faces from losing their shoulders.
    left = max(0, min(x - fw * 0.7 for x, y, fw, fh in boxes))
    right = min(width, max(x + fw * 1.7 for x, y, fw, fh in boxes))
    top = max(0, min(y - fh * 0.6 for x, y, fw, fh in boxes))
    bottom = min(height, max(y + fh * 3.1 for x, y, fw, fh in boxes))
    side = max(right - left, bottom - top, min(width, height) / MAX_ZOOM)
    # A square cannot include this entire padded group without letterboxing.
    # Leave it to the normal UI instead of sacrificing a person to extra zoom.
    if side > min(width, height):
        return None, "group_needs_full_photo"
    center_x, center_y = (left + right) / 2, (top + bottom) / 2
    x = max(0, min(width - side, center_x - side / 2))
    y = max(0, min(height - side, center_y - side / 2))
    if any(x > bx or y > by or x + side < bx + bw or y + side < by + bh
           for bx, by, bw, bh in boxes):
        return None, "face_outside_crop"
    values = [x / width, y / height, side / width, side / height]
    if not all(math.isfinite(value) and 0 <= value <= 1 for value in values):
        return None, "invalid_geometry"
    return [round(value, 6) for value in values], "crop"


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".delivery-crops-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--cache-dir", type=Path, default=Path(tempfile.gettempdir()) / "netcar-delivery-face-crops")
    parser.add_argument("--recent-only", action="store_true")
    parser.add_argument("--detections", type=Path, help="Use an existing detector JSONL, offline geometry only")
    options = parser.parse_args()
    cache_dir = options.cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    sources = ["deliveries-recent.json"]
    if not options.recent_only:
        sources += ["deliveries-instagram.json", "deliveries-preview.json"]
    inputs = []
    for filename in sources:
        for item in json.loads((DATA / filename).read_text())["deliveries"]:
            url = item["imageUrl"]
            if not url.startswith("/entregas-media/"):
                continue
            path = (ROOT / "public" / url.lstrip("/")).resolve()
            if not path.is_relative_to((ROOT / "public/entregas-media").resolve()) or not path.is_file():
                continue
            inputs.append({"id": item["id"], "path": str(path)})
    if options.detections:
        detections = [json.loads(line) for line in options.detections.read_text().splitlines() if line.strip()]
    else:
        signature = hashlib.sha256(DETECTOR.read_bytes())
        for item in inputs:
            signature.update(item["id"].encode())
            signature.update(hashlib.sha256(Path(item["path"]).read_bytes()).digest())
        detections_path = cache_dir / (signature.hexdigest()[:24] + ".jsonl")
        if not detections_path.exists():
            executable = cache_dir / "detector"
            subprocess.run(["xcrun", "swiftc", "-O", str(DETECTOR), "-o", str(executable)], check=True)
            manifest = cache_dir / "input.json"
            atomic_json(manifest, inputs)
            partial = detections_path.with_suffix(".partial.jsonl")
            with partial.open("w") as stream:
                subprocess.run([str(executable), str(manifest)], stdout=stream, check=True)
            os.replace(partial, detections_path)
        detections = [json.loads(line) for line in detections_path.read_text().splitlines() if line.strip()]
    allowed_ids = {item["id"] for item in inputs}
    crops = {}
    counts = Counter()
    for detection in detections:
        if detection["id"] not in allowed_ids:
            continue
        crop, reason = crop_for_detection(detection)
        counts[reason] += 1
        if crop:
            crops[detection["id"]] = crop
    atomic_json(options.output, crops)
    report = {"local_images": len(inputs), "inspected": len(detections),
              "crops": len(crops), "max_zoom": MAX_ZOOM, "results": dict(counts)}
    atomic_json(cache_dir / "report.json", report)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
