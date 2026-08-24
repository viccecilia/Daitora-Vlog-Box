import argparse
import datetime
import json
import shutil
import sqlite3
from pathlib import Path

APP = Path("/home/ubuntu/daitora-media-library")
DB = APP / "data/daitora.db"
MEDIA_DIRS = {
    "uploads": APP / "data/uploads",
    "finished-products": APP / "data/finished-products",
    "asset-memos": APP / "data/asset-memos",
}
TABLES = ("material_packages", "assets", "finished_products", "revisions", "notifications", "package_status_history", "audit_logs")
BUSINESS_OBJECTS = ("material_package", "asset", "finished_product", "revision", "revision_batch")


def safe_source(root: Path, name: str) -> Path | None:
    candidate = (root / name).resolve()
    resolved_root = root.resolve()
    if candidate.parent != resolved_root:
        raise RuntimeError(f"unsafe media path: {candidate}")
    return candidate if candidate.is_file() else None


parser = argparse.ArgumentParser()
parser.add_argument("--execute", action="store_true")
args = parser.parse_args()
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

with sqlite3.connect(DB) as conn:
    conn.row_factory = sqlite3.Row
    before = {table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in TABLES}
    users_before = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    media = []
    for row in conn.execute("SELECT stored_name,memo_voice_name FROM assets"):
        media.append(("uploads", row["stored_name"]))
        if row["memo_voice_name"]:
            media.append(("asset-memos", row["memo_voice_name"]))
    for row in conn.execute("SELECT stored_name FROM finished_products"):
        media.append(("finished-products", row["stored_name"]))
    media = list(dict.fromkeys(media))
    validated = []
    missing = []
    for area, name in media:
        source = safe_source(MEDIA_DIRS[area], name)
        (validated if source else missing).append((area, name))
    plan = {"execute": args.execute, "counts": before, "users_preserved": users_before, "media_candidates": len(media), "media_present": len(validated), "media_missing": missing}
    print(json.dumps(plan, ensure_ascii=False))
    if not args.execute:
        raise SystemExit(0)

    conn.execute("BEGIN IMMEDIATE")
    conn.execute("DELETE FROM notifications WHERE package_id IS NOT NULL")
    conn.execute("DELETE FROM revisions")
    conn.execute("DELETE FROM finished_products")
    conn.execute("DELETE FROM package_status_history")
    conn.execute("DELETE FROM assets")
    conn.execute("DELETE FROM material_packages")
    marks = ",".join("?" for _ in BUSINESS_OBJECTS)
    conn.execute(f"DELETE FROM audit_logs WHERE object_type IN ({marks})", BUSINESS_OBJECTS)
    conn.commit()

quarantine = APP / "quarantine" / stamp
moved = []
for area, name in validated:
    source = safe_source(MEDIA_DIRS[area], name)
    assert source is not None
    destination = quarantine / area / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))
    moved.append({"area": area, "name": name, "size": destination.stat().st_size})

(quarantine / "moved-media.json").write_text(json.dumps(moved, ensure_ascii=False, indent=2), encoding="utf-8")
with sqlite3.connect(DB) as conn:
    after = {table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in TABLES}
    users_after = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
if users_after != users_before or any(after[table] for table in ("material_packages", "assets", "finished_products", "revisions", "notifications", "package_status_history")) or integrity != "ok":
    raise SystemExit("post-cleanup verification failed")
print(json.dumps({"before": before, "after": after, "users": users_after, "integrity": integrity, "quarantine": str(quarantine), "moved": len(moved), "missing": missing}, ensure_ascii=False))
