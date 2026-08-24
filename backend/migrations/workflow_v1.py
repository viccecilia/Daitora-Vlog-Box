import sqlite3

VERSION = "20260818_workflow_v1"


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _add_column(conn: sqlite3.Connection, table: str, definition: str) -> None:
    name = definition.split()[0]
    if name not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {definition}")


def apply(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
    if conn.execute("SELECT 1 FROM schema_migrations WHERE version=?", (VERSION,)).fetchone():
        return
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS material_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      shoot_date TEXT NOT NULL,
      theme TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL,
      submitted_at TEXT,
      updated_at TEXT NOT NULL,
      legacy INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_packages_driver_updated ON material_packages(driver_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_packages_status_submitted ON material_packages(status, submitted_at);
    CREATE TABLE IF NOT EXISTS package_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL REFERENCES material_packages(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      package_id INTEGER REFERENCES material_packages(id),
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      read_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, unread, created_at DESC);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      object_type TEXT NOT NULL,
      object_id INTEGER,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    """)
    _add_column(conn, "assets", "package_id INTEGER REFERENCES material_packages(id)")
    _add_column(conn, "assets", "upload_status TEXT NOT NULL DEFAULT 'completed'")
    _add_column(conn, "finished_products", "package_id INTEGER REFERENCES material_packages(id)")
    _add_column(conn, "finished_products", "version_number INTEGER NOT NULL DEFAULT 1")
    _add_column(conn, "finished_products", "version_note TEXT NOT NULL DEFAULT ''")
    _add_column(conn, "finished_products", "duration_seconds REAL")
    _add_column(conn, "finished_products", "resolution TEXT")
    _add_column(conn, "finished_products", "is_current INTEGER NOT NULL DEFAULT 1")
    _add_column(conn, "finished_products", "is_final INTEGER NOT NULL DEFAULT 0")
    _add_column(conn, "revisions", "timecode TEXT")
    _add_column(conn, "revisions", "attachment_name TEXT")
    _add_column(conn, "revisions", "resolved_by INTEGER REFERENCES users(id)")
    _add_column(conn, "revisions", "resolved_at TEXT")
    legacy_drivers = conn.execute("SELECT DISTINCT driver_id FROM assets WHERE package_id IS NULL").fetchall()
    for (driver_id,) in legacy_drivers:
        user = conn.execute("SELECT display_name FROM users WHERE id=?", (driver_id,)).fetchone()
        latest = conn.execute("SELECT COALESCE(MAX(uploaded_at),datetime('now')) FROM assets WHERE driver_id=?", (driver_id,)).fetchone()[0]
        package_id = conn.execute(
            "INSERT INTO material_packages(driver_id,title,shoot_date,theme,status,created_at,submitted_at,updated_at,legacy) VALUES(?,?,?,?,?,?,?,?,1)",
            (driver_id, f"{user[0]}｜历史素材包", latest[:10], "其他", "ARCHIVED", latest, latest, latest),
        ).lastrowid
        conn.execute("UPDATE assets SET package_id=? WHERE driver_id=? AND package_id IS NULL", (package_id, driver_id))
        conn.execute("UPDATE finished_products SET package_id=? WHERE driver_id=? AND package_id IS NULL", (package_id, driver_id))
    conn.execute("INSERT INTO schema_migrations(version,applied_at) VALUES(?,datetime('now'))", (VERSION,))
