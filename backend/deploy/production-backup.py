import datetime
import os
import shutil
import sqlite3
from pathlib import Path

app = Path("/home/ubuntu/daitora-media-library")
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup = Path("/home/ubuntu/backups/daitora-vlog-box") / stamp
backup.mkdir(parents=True, exist_ok=False)

source_db = app / "data/daitora.db"
with sqlite3.connect(source_db) as source, sqlite3.connect(backup / "daitora.db") as target:
    source.backup(target)
    integrity = target.execute("PRAGMA integrity_check").fetchone()[0]

for source in [app / "app.py", app / ".env", Path("/etc/nginx/sites-available/api-vlog.daitora-jp.com"), Path("/etc/systemd/system/daitora-vlog-api.service")]:
    if source.exists():
        shutil.copy2(source, backup / source.name)

web_root = Path("/var/www/daitora-vlog-box")
if web_root.exists():
    shutil.make_archive(str(backup / "web-root"), "gztar", web_root)

os.chmod(backup / "daitora.db", 0o600)
print(backup)
print(f"database_integrity={integrity}")
