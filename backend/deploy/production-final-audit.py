import hashlib
import json
import sqlite3
from pathlib import Path

app = Path("/home/ubuntu/daitora-media-library")
db = sqlite3.connect(app / "data/daitora.db")
db.row_factory = sqlite3.Row


def rows(query):
    return [dict(row) for row in db.execute(query)]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


assets = rows("SELECT id,original_name,stored_name,size_bytes,memo_text FROM assets ORDER BY id")
products = rows("SELECT f.id,f.package_id,u.account,f.stored_name,f.size_bytes,f.version_number,f.is_current,f.is_final FROM finished_products f JOIN users u ON u.id=f.driver_id ORDER BY f.id")
for item in assets:
    item["sha256"] = sha256(app / "data/uploads" / item["stored_name"])
for item in products:
    item["sha256"] = sha256(app / "data/finished-products" / item["stored_name"])

print(json.dumps({
    "integrity": db.execute("PRAGMA integrity_check").fetchone()[0],
    "users": rows("SELECT account,display_name,role,active FROM users ORDER BY account"),
    "packages": rows("SELECT p.id,u.account,p.title,p.status FROM material_packages p JOIN users u ON u.id=p.driver_id"),
    "assets": assets,
    "products": products,
    "revisions": rows("SELECT id,product_id,timecode,message,reply,status FROM revisions"),
    "quarantines": [str(path.parent) for path in sorted((app / "quarantine").glob("*/moved-media.json"))],
}, ensure_ascii=False, indent=2))
