import sqlite3
from pathlib import Path

db_path = Path("/home/ubuntu/daitora-media-library/data/daitora.db")
with sqlite3.connect(db_path) as conn:
    print(f"integrity={conn.execute('PRAGMA integrity_check').fetchone()[0]}")
    for table in ("users", "material_packages", "assets", "finished_products", "revisions", "audit_logs"):
        print(f"count.{table}={conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]}")
    for table in ("material_packages", "assets", "finished_products"):
        columns = ",".join(row[1] for row in conn.execute(f"PRAGMA table_info({table})"))
        print(f"columns.{table}={columns}")
