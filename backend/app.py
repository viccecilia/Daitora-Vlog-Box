import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DAITORA_DATA_DIR", APP_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "daitora.db"
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(200 * 1024 * 1024)))
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", str(7 * 24 * 3600)))
ALLOWED_ORIGINS = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "https://daitora-vlog-box-prototype.pangvic9.chatgpt.site").split(",") if item.strip()]

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Daitora Vlog Box API", version="0.1.0", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{salt.hex()}:{digest.hex()}"


def password_matches(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split(":", 1)
    candidate = password_hash(password, bytes.fromhex(salt_hex)).split(":", 1)[1]
    return hmac.compare_digest(candidate, digest_hex)


def initialize_database():
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('driver','editor','admin')),
          password_hash TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id INTEGER NOT NULL REFERENCES users(id),
          uploader_id INTEGER NOT NULL REFERENCES users(id),
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          media_type TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_assets_driver_time ON assets(driver_id, uploaded_at DESC);
        """)
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            initial = [
                ("admin", "管理员", "admin", os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "Daitora1028")),
                ("editor", "剪辑工作台", "editor", os.getenv("BOOTSTRAP_EDITOR_PASSWORD", "Daitora1028")),
                ("D023", "王小明", "driver", os.getenv("BOOTSTRAP_DRIVER_PASSWORD", "123456")),
                ("D024", "陈师傅", "driver", os.getenv("BOOTSTRAP_DRIVER_PASSWORD", "123456")),
                ("D025", "李师傅", "driver", os.getenv("BOOTSTRAP_DRIVER_PASSWORD", "123456")),
            ]
            conn.executemany("INSERT INTO users(account,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)", [(a,n,r,password_hash(p),now) for a,n,r,p in initial])


initialize_database()


class LoginBody(BaseModel):
    account: str
    password: str


def current_user(authorization: Annotated[str | None, Header()] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "authentication required")
    token = authorization[7:]
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db() as conn:
        row = conn.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1", (token_hash, int(time.time()))).fetchone()
    if not row:
        raise HTTPException(401, "invalid or expired session")
    return dict(row)


def require_editor(user=Depends(current_user)):
    if user["role"] not in ("editor", "admin"):
        raise HTTPException(403, "editor access required")
    return user


@app.get("/health")
def health():
    return {"status": "ok", "service": "daitora-vlog-box-api"}


@app.post("/v1/auth/login")
def login(body: LoginBody):
    account = body.account.strip()
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(account)=lower(?) AND active=1", (account,)).fetchone()
        if not row or not password_matches(body.password, row["password_hash"]):
            time.sleep(0.35)
            raise HTTPException(401, "账号或密码不正确")
        token = secrets.token_urlsafe(40)
        conn.execute("DELETE FROM sessions WHERE expires_at<=?", (int(time.time()),))
        conn.execute("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], int(time.time()) + TOKEN_TTL_SECONDS))
    return {"token": token, "user": {"id": row["account"], "name": row["display_name"], "role": row["role"]}}


@app.get("/v1/me")
def me(user=Depends(current_user)):
    return {"id": user["account"], "name": user["display_name"], "role": user["role"]}


@app.get("/v1/driver-asset-packages")
def driver_asset_packages(driver_id: str | None = None, sort: str = "time", user=Depends(require_editor)):
    order = "CASE WHEN a.media_type='video' THEN 0 ELSE 1 END, a.uploaded_at DESC" if sort == "type" else "a.uploaded_at DESC"
    params: list[str] = []
    where = "WHERE u.role='driver'"
    if driver_id:
        where += " AND u.account=?"
        params.append(driver_id)
    with db() as conn:
        drivers = conn.execute(f"SELECT u.id,u.account,u.display_name,COUNT(a.id) count,COALESCE(SUM(a.size_bytes),0) size_bytes,MAX(a.uploaded_at) latest FROM users u LEFT JOIN assets a ON a.driver_id=u.id {where} GROUP BY u.id ORDER BY COALESCE(MAX(a.uploaded_at),'') DESC,u.account", params).fetchall()
        result = []
        for driver in drivers:
            files = conn.execute(f"SELECT id,original_name,media_type,mime_type,size_bytes,uploaded_at FROM assets a WHERE driver_id=? ORDER BY {order} LIMIT 100", (driver["id"],)).fetchall()
            result.append({"id": f"DRIVER-{driver['account']}", "driver": driver["display_name"], "code": driver["account"], "count": driver["count"], "sizeBytes": driver["size_bytes"], "latestUpload": driver["latest"], "files": [dict(item) for item in files]})
    return {"items": result}


@app.post("/v1/assets/upload")
async def upload_asset(file: Annotated[UploadFile, File()], driver_code: Annotated[str | None, Form()] = None, user=Depends(current_user)):
    target_code = user["account"] if user["role"] == "driver" else (driver_code or "")
    if user["role"] != "driver" and not target_code:
        raise HTTPException(400, "driver_code is required")
    with db() as conn:
        driver = conn.execute("SELECT * FROM users WHERE account=? AND role='driver' AND active=1", (target_code,)).fetchone()
    if not driver:
        raise HTTPException(404, "driver not found")
    safe_suffix = Path(file.filename or "upload.bin").suffix.lower()[:12]
    stored_name = f"{driver['account']}_{int(time.time())}_{secrets.token_hex(8)}{safe_suffix}"
    destination = UPLOAD_DIR / stored_name
    size = 0
    try:
        with destination.open("xb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "file too large")
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    media_type = "video" if (file.content_type or "").startswith("video/") else "image" if (file.content_type or "").startswith("image/") else "file"
    uploaded_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        cursor = conn.execute("INSERT INTO assets(driver_id,uploader_id,original_name,stored_name,media_type,mime_type,size_bytes,uploaded_at) VALUES(?,?,?,?,?,?,?,?)", (driver["id"], user["id"], file.filename or stored_name, stored_name, media_type, file.content_type or "application/octet-stream", size, uploaded_at))
        asset_id = cursor.lastrowid
    return {"id": asset_id, "name": file.filename, "type": media_type, "sizeBytes": size, "uploadedAt": uploaded_at}


@app.get("/v1/assets/{asset_id}/download")
def download_asset(asset_id: int, user=Depends(current_user)):
    with db() as conn:
        row = conn.execute("SELECT a.*,u.account driver_code FROM assets a JOIN users u ON u.id=a.driver_id WHERE a.id=?", (asset_id,)).fetchone()
    if not row:
        raise HTTPException(404, "asset not found")
    if user["role"] == "driver" and row["driver_id"] != user["id"]:
        raise HTTPException(403, "access denied")
    path = UPLOAD_DIR / row["stored_name"]
    if not path.is_file():
        raise HTTPException(410, "stored file missing")
    return FileResponse(path, media_type=row["mime_type"], filename=row["original_name"])

