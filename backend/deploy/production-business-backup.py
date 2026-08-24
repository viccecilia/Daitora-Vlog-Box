import datetime
import hashlib
import json
import os
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


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
target = Path("/home/ubuntu/backups/daitora-vlog-box") / stamp
target.mkdir(parents=True, exist_ok=False)

with sqlite3.connect(DB) as source, sqlite3.connect(target / "daitora.db") as backup:
    source.backup(backup)
    integrity = backup.execute("PRAGMA integrity_check").fetchone()[0]
    counts = {
        table: backup.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ("users", "material_packages", "assets", "finished_products", "revisions", "audit_logs")
    }

manifest = []
for area, root in MEDIA_DIRS.items():
    if not root.exists():
        continue
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        manifest.append({
            "area": area,
            "relative_path": path.relative_to(root).as_posix(),
            "size": path.stat().st_size,
            "sha256": sha256(path),
        })

(target / "media-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
(target / "backup-summary.json").write_text(json.dumps({
    "created_at": stamp,
    "database": str(DB),
    "database_integrity": integrity,
    "database_size": (target / "daitora.db").stat().st_size,
    "counts": counts,
    "media_files": len(manifest),
    "media_bytes": sum(item["size"] for item in manifest),
}, ensure_ascii=False, indent=2), encoding="utf-8")

for source in (
    APP / "app.py",
    APP / ".env",
    Path("/etc/nginx/sites-available/api-vlog.daitora-jp.com"),
    Path("/etc/systemd/system/daitora-vlog-api.service"),
):
    if source.exists():
        shutil.copy2(source, target / f"config-{source.name}")

os.chmod(target / "daitora.db", 0o600)
if integrity != "ok" or (target / "daitora.db").stat().st_size == 0:
    raise SystemExit("backup verification failed")
print(target)
print((target / "backup-summary.json").read_text(encoding="utf-8"))
