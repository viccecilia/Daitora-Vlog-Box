import sqlite3

VERSION = "20260821_domain_v3"


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _add(conn: sqlite3.Connection, table: str, definition: str) -> None:
    if definition.split()[0] not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {definition}")


def apply(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
    if conn.execute("SELECT 1 FROM schema_migrations WHERE version=?", (VERSION,)).fetchone():
        return
    _add(conn, "users", "updated_at TEXT")
    _add(conn, "material_packages", "location TEXT NOT NULL DEFAULT ''")
    _add(conn, "material_packages", "tags TEXT NOT NULL DEFAULT '[]'")
    _add(conn, "material_packages", "usage TEXT NOT NULL DEFAULT ''")
    _add(conn, "assets", "duration_seconds REAL")
    _add(conn, "assets", "width INTEGER")
    _add(conn, "assets", "height INTEGER")
    _add(conn, "assets", "orientation TEXT NOT NULL DEFAULT 'unknown'")
    _add(conn, "assets", "thumbnail_key TEXT")
    _add(conn, "assets", "updated_at TEXT")
    _add(conn, "finished_products", "updated_at TEXT")
    _add(conn, "revisions", "updated_at TEXT")
    conn.execute("UPDATE material_packages SET theme='未分类' WHERE legacy=1 AND theme='其他'")
    conn.execute("UPDATE material_packages SET tags='[]' WHERE tags IS NULL OR trim(tags)='' ")
    conn.execute("UPDATE assets SET orientation='unknown' WHERE orientation IS NULL OR trim(orientation)='' ")
    conn.executescript("""
    CREATE INDEX IF NOT EXISTS idx_packages_shoot_date ON material_packages(shoot_date DESC);
    CREATE INDEX IF NOT EXISTS idx_packages_theme_status ON material_packages(theme,status);
    CREATE INDEX IF NOT EXISTS idx_assets_package_uploaded ON assets(package_id,uploaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assets_type_orientation ON assets(media_type,orientation);
    """)
    conn.execute("INSERT INTO schema_migrations(version,applied_at) VALUES(?,datetime('now'))", (VERSION,))

