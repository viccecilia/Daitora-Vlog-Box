import argparse
import hashlib
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{salt.hex()}:{digest.hex()}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--driver-password", required=True)
    parser.add_argument("--editor-password", required=True)
    args = parser.parse_args()

    accounts = [
        ("admin00", "剪辑师", "editor", args.editor_password),
        ("admin01", "admin01", "driver", args.driver_password),
        ("admin02", "admin02", "driver", args.driver_password),
        ("admin03", "admin03", "driver", args.driver_password),
    ]
    now = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(args.db) as conn:
        for account, display_name, role, password in accounts:
            existing = conn.execute(
                "SELECT id FROM users WHERE lower(account)=lower(?)", (account,)
            ).fetchone()
            if existing:
                user_id = existing[0]
                conn.execute(
                    "UPDATE users SET account=?, display_name=?, role=?, password_hash=?, active=1 WHERE id=?",
                    (account, display_name, role, password_hash(password), user_id),
                )
            else:
                cursor = conn.execute(
                    "INSERT INTO users(account,display_name,role,password_hash,active,created_at) VALUES(?,?,?,?,1,?)",
                    (account, display_name, role, password_hash(password), now),
                )
                user_id = cursor.lastrowid
            conn.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))

        rows = conn.execute(
            "SELECT account, role, active FROM users WHERE account IN ('admin00','admin01','admin02','admin03') ORDER BY account"
        ).fetchall()
        for account, role, active in rows:
            print(f"{account}\t{role}\tactive={active}")


if __name__ == "__main__":
    main()
