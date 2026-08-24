import sqlite3

VERSION = "20260819_asset_memo_v2"


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def apply(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
    if conn.execute("SELECT 1 FROM schema_migrations WHERE version=?", (VERSION,)).fetchone():
        return
    columns = _columns(conn, "assets")
    if "memo_text" not in columns:
        conn.execute("ALTER TABLE assets ADD COLUMN memo_text TEXT NOT NULL DEFAULT ''")
    if "memo_voice_name" not in columns:
        conn.execute("ALTER TABLE assets ADD COLUMN memo_voice_name TEXT")
    if "memo_voice_mime" not in columns:
        conn.execute("ALTER TABLE assets ADD COLUMN memo_voice_mime TEXT")
    if "memo_voice_size" not in columns:
        conn.execute("ALTER TABLE assets ADD COLUMN memo_voice_size INTEGER")
    if "memo_updated_at" not in columns:
        conn.execute("ALTER TABLE assets ADD COLUMN memo_updated_at TEXT")
    conn.execute("INSERT INTO schema_migrations(version,applied_at) VALUES(?,datetime('now'))", (VERSION,))
