#!/usr/bin/env python3
"""Import already-downloaded Instagram highlight photos. No network access.

Usage:
  python3 scripts/import-instagram-deliveries.py /tmp/netcar-instagram-highlights/batch-*.json

Each manifest is an array or {"items": [...]} with entries:
  {"highlightTitle": "CLIENTES XIV", "highlightUrl": "https://www.instagram.com/...",
   "publishedAt": "2026-04-25", "imagePath": "/absolute/local/photo.jpg",
   "sourceAssetName": "123456789_987654321_123456789_n.jpg"}

publishedAt may be null. Dates and customer names are never inferred from pixels.
The existing marketing and archive JSON files and images are never modified.
"""

import argparse
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse
from zoneinfo import ZoneInfo

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
INDEX_RELATIVE = Path("src/modules/entregas/data/deliveries-instagram.json")
MEDIA_RELATIVE = Path("public/entregas-media/instagram")
WEB_PREFIX = "/entregas-media/instagram"
NETCAR_TIMEZONE = ZoneInfo("America/Sao_Paulo")


def publication_date(value):
    if value is None or value == "":
        return None, None
    if not isinstance(value, str):
        raise ValueError("publishedAt must be an ISO string or null")
    # Explicit timestamps use Netcar's calendar day. Date-only/naive values keep
    # the source's calendar day because no source offset was supplied.
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(NETCAR_TIMEZONE)
    return value.strip(), parsed.date().isoformat()


def publication_sort_key(record):
    value = record.get("publishedAt")
    if not value:
        return float("-inf")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=NETCAR_TIMEZONE)
    return parsed.timestamp()


def stable_asset_key(value):
    """Only Instagram's long numeric filenames are stable enough for dedup."""
    if not isinstance(value, str) or not value.strip():
        return None
    leaf = Path(unquote(urlparse(value.strip()).path)).name
    stem = Path(leaf).stem
    if re.fullmatch(r"\d{8,}(?:_\d{5,})+(?:_[a-z])?", stem, flags=re.IGNORECASE):
        return stem.lower()
    return None


def load_manifest(path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload if isinstance(payload, list) else payload.get("items")
    if not isinstance(items, list):
        raise ValueError(f"{path}: expected an array or {{items: [...]}}")
    return items


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     prefix=f".{path.stem}-", suffix=".tmp", delete=False) as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temporary = Path(file.name)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_webp(image, path, quality):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.stem}-",
                                     suffix=".tmp", delete=False) as file:
        temporary = Path(file.name)
    try:
        image.save(temporary, format="WEBP", quality=quality, method=6)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def generate_variants(source_path, identifier, media_dir):
    with Image.open(source_path) as original:
        photo = ImageOps.exif_transpose(original)
        photo = photo.convert("RGBA" if "A" in photo.getbands() else "RGB")
        photo.load()
    media_dir.mkdir(parents=True, exist_ok=True)
    full_name = f"{identifier}.webp"
    atomic_webp(photo, media_dir / full_name, quality=88)
    variants = []
    for width in sorted({min(width, photo.width) for width in (320, 640, 960)}):
        height = max(1, round(photo.height * width / photo.width))
        resized = photo.resize((width, height), Image.Resampling.LANCZOS)
        filename = f"{identifier}-{width}.webp"
        atomic_webp(resized, media_dir / filename, quality=80)
        variants.append((width, f"{WEB_PREFIX}/{filename}"))
    preview = min(variants, key=lambda variant: abs(variant[0] - 640))[1]
    return {
        "imageUrl": f"{WEB_PREFIX}/{full_name}",
        "previewImageUrl": preview,
        "previewSrcSet": ", ".join(f"{url} {width}w" for width, url in variants),
    }


def import_manifests(manifest_paths, project_root=ROOT):
    index_path = project_root / INDEX_RELATIVE
    media_dir = project_root / MEDIA_RELATIVE
    existing = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"deliveries": []}
    records = existing.get("deliveries")
    if not isinstance(records, list):
        raise ValueError("Instagram index must contain a deliveries array")

    hash_index = {}
    asset_index = {}
    for record in records:
        for digest in [record.get("contentSha256"), *record.get("contentSha256Aliases", [])]:
            if digest:
                hash_index[digest] = record
        for name in [record.get("sourceAssetName"), *record.get("sourceAssetAliases", [])]:
            key = stable_asset_key(name)
            if key:
                asset_index[key] = record
    pending = []
    repairs = {}
    duplicates = 0
    updated_ids = set()
    # Validate every item before generating files or changing the index.
    for manifest_path in manifest_paths:
        manifest_path = Path(manifest_path).resolve()
        for position, item in enumerate(load_manifest(manifest_path), start=1):
            if not isinstance(item, dict):
                raise ValueError(f"{manifest_path.name} item {position}: expected an object")
            image_path = item.get("imagePath")
            if not isinstance(image_path, str) or not image_path or "://" in image_path:
                raise ValueError(f"{manifest_path.name} item {position}: imagePath must be a local file")
            local_path = Path(image_path).expanduser()
            if not local_path.is_absolute():
                local_path = manifest_path.parent / local_path
            local_path = local_path.resolve(strict=True)
            if not local_path.is_file():
                raise ValueError(f"{local_path}: not a file")
            with local_path.open("rb") as file:
                content_hash = hashlib.sha256(file.read()).hexdigest()
            published_at, date = publication_date(item.get("publishedAt"))
            asset_name = item.get("sourceAssetName") or local_path.name
            if not isinstance(asset_name, str):
                raise ValueError("sourceAssetName must be a string")
            asset_key = stable_asset_key(asset_name)
            title = item.get("highlightTitle") or ""
            source_url = item.get("highlightUrl") or ""
            if not isinstance(title, str) or not isinstance(source_url, str):
                raise ValueError("highlightTitle and highlightUrl must be strings")
            if source_url:
                parsed_url = urlparse(source_url)
                if parsed_url.scheme != "https" or parsed_url.hostname not in ("instagram.com", "www.instagram.com"):
                    raise ValueError("highlightUrl must be an HTTPS Instagram URL")
            with Image.open(local_path) as probe:
                probe.verify()
            with Image.open(local_path) as probe:
                # Detect truncated image data before writing any batch output.
                ImageOps.exif_transpose(probe).load()
            duplicate = hash_index.get(content_hash) or (asset_index.get(asset_key) if asset_key else None)
            if duplicate is not None:
                duplicates += 1
                if content_hash not in hash_index:
                    duplicate.setdefault("contentSha256Aliases", []).append(content_hash)
                    updated_ids.add(duplicate["id"])
                if asset_key and asset_key not in asset_index:
                    duplicate.setdefault("sourceAssetAliases", []).append(asset_name)
                    updated_ids.add(duplicate["id"])
                # Preserve edited names, captions and existing dates. Only fill
                # an absent date when the new manifest supplies publication data.
                if not duplicate.get("date") and date:
                    duplicate.update({"date": date, "year": date[:4], "month": date[5:7], "publishedAt": published_at})
                    updated_ids.add(duplicate["id"])
                urls = [duplicate.get("imageUrl"), duplicate.get("previewImageUrl")]
                urls.extend(part.strip().split(" ")[0] for part in duplicate.get("previewSrcSet", "").split(",") if part.strip())
                if any(url and url.startswith(WEB_PREFIX + "/") and not (project_root / "public" / url.lstrip("/")).is_file() for url in urls):
                    repairs[duplicate["id"]] = (local_path, duplicate)
                hash_index[content_hash] = duplicate
                if asset_key:
                    asset_index[asset_key] = duplicate
                continue
            identifier = f"instagram-{content_hash[:24]}"
            record = {
                "id": identifier,
                "name": "",
                "imagePosition": "center 22%",
                "date": date,
                "year": date[:4] if date else None,
                "month": date[5:7] if date else None,
                "source": "instagram",
                "publishedAt": published_at,
                "sourceLabel": title.strip(),
                "sourceUrl": source_url,
                "sourceAssetName": asset_name,
                "contentSha256": content_hash,
            }
            pending.append((local_path, record))
            hash_index[content_hash] = record
            if asset_key:
                asset_index[asset_key] = record

    for source_path, record in pending:
        record.update(generate_variants(source_path, record["id"], media_dir))
        records.append(record)
    for source_path, record in repairs.values():
        record.update(generate_variants(source_path, record["id"], media_dir))
    if pending or updated_ids or repairs:
        # Preserve newest-first order within equal calendar days; the page's
        # existing stable date sort still determines the combined gallery order.
        records.sort(key=publication_sort_key, reverse=True)
        metadata = {
            **existing.get("metadata", {}),
            "source": "instagram",
            "dateMeaning": "publication-date",
            "publicationTimezone": "America/Sao_Paulo",
            "deliveryDateVerified": False,
            "lastImportedAt": datetime.now(timezone.utc).isoformat(),
            "importedCount": len(records),
        }
        atomic_json(index_path, {"metadata": metadata, "deliveries": records})
    return {"imported": len(pending), "skippedDuplicates": duplicates,
            "updatedMetadata": len(updated_ids), "repairedMedia": len(repairs),
            "totalInstagramPhotos": len(records)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("manifests", nargs="+", type=Path)
    args = parser.parse_args()
    summary = import_manifests(args.manifests)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
