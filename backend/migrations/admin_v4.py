import sqlite3

VERSION = "20260821_admin_v4"


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _add(conn: sqlite3.Connection, table: str, definition: str) -> None:
    if definition.split()[0] not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {definition}")


def apply(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
    if conn.execute("SELECT 1 FROM schema_migrations WHERE version=?", (VERSION,)).fetchone():
        return
    _add(conn, "users", "last_login_at TEXT")
    _add(conn, "users", "disabled_at TEXT")
    _add(conn, "users", "must_change_password INTEGER NOT NULL DEFAULT 0")
    _add(conn, "users", "is_super_admin INTEGER NOT NULL DEFAULT 0")
    _add(conn, "sessions", "created_at TEXT")
    _add(conn, "audit_logs", "result TEXT NOT NULL DEFAULT 'success'")
    _add(conn, "audit_logs", "ip_address TEXT")
    _add(conn, "audit_logs", "before_value TEXT")
    _add(conn, "audit_logs", "after_value TEXT")
    _add(conn, "material_packages", "deleted_at TEXT")
    _add(conn, "assets", "deleted_at TEXT")
    _add(conn, "finished_products", "deleted_at TEXT")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS backup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      location TEXT,
      size_bytes INTEGER,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role,active);
    CREATE INDEX IF NOT EXISTS idx_audit_created_action ON audit_logs(created_at DESC,action);
    """)
    first_admin = conn.execute("SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1").fetchone()
    if first_admin:
        conn.execute("UPDATE users SET is_super_admin=1 WHERE id=?", (first_admin[0],))
    conn.execute("INSERT INTO schema_migrations(version,applied_at) VALUES(?,datetime('now'))", (VERSION,))
