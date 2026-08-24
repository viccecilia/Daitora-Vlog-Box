import hashlib
import hmac
import json
import os
import secrets
import shutil
import sqlite3
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
from migrations.workflow_v1 import apply as apply_workflow_migration
from migrations.asset_memo_v2 import apply as apply_asset_memo_migration
from migrations.domain_v3 import apply as apply_domain_migration
from migrations.admin_v4 import apply as apply_admin_migration

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DAITORA_DATA_DIR", APP_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
FINISHED_DIR = DATA_DIR / "finished-products"
MEMO_DIR = DATA_DIR / "asset-memos"
DB_PATH = DATA_DIR / "daitora.db"
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "0"))
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", str(7 * 24 * 3600)))
DEFAULT_ORIGINS = ",".join([
    "https://daitora-vlog-box-prototype.pangvic9.chatgpt.site",
    "https://vlog.daitora-jp.com",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
])
ALLOWED_ORIGINS = [
    item.strip()
    for item in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if item.strip()
]

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
FINISHED_DIR.mkdir(parents=True, exist_ok=True)
MEMO_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Daitora Vlog Box API", version="0.1.0", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])


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
        CREATE TABLE IF NOT EXISTS finished_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id INTEGER NOT NULL REFERENCES users(id),
          uploader_id INTEGER NOT NULL REFERENCES users(id),
          title TEXT NOT NULL,
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX IF NOT EXISTS idx_finished_driver_time ON finished_products(driver_id, uploaded_at DESC);
        CREATE TABLE IF NOT EXISTS revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES finished_products(id) ON DELETE CASCADE,
          driver_id INTEGER NOT NULL REFERENCES users(id),
          message TEXT NOT NULL,
          created_at TEXT NOT NULL,
          reply TEXT,
          replied_by INTEGER REFERENCES users(id),
          replied_at TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX IF NOT EXISTS idx_revisions_product_time ON revisions(product_id, created_at DESC);
        """)
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            admin_password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or secrets.token_urlsafe(24)
            editor_password = os.getenv("BOOTSTRAP_EDITOR_PASSWORD") or secrets.token_urlsafe(24)
            uploader_password = os.getenv("BOOTSTRAP_UPLOADER_PASSWORD") or secrets.token_urlsafe(24)
            initial = [
                ("admin", "管理员", "admin", admin_password),
                ("admin00", "剪辑师", "editor", editor_password),
                ("admin01", "admin01", "driver", uploader_password),
                ("admin02", "admin02", "driver", uploader_password),
                ("admin03", "admin03", "driver", uploader_password),
            ]
            conn.executemany("INSERT INTO users(account,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)", [(a,n,r,password_hash(p),now) for a,n,r,p in initial])
        apply_workflow_migration(conn)
        apply_asset_memo_migration(conn)
        apply_domain_migration(conn)
        apply_admin_migration(conn)


initialize_database()


class LoginBody(BaseModel):
    account: str
    password: str


class MessageBody(BaseModel):
    message: str


class ProfileBody(BaseModel):
    name: str


class PackageCreateBody(BaseModel):
    shootDate: str
    theme: str
    title: str
    location: str = ""
    tags: list[str] = []
    usage: str = ""


class PackageUpdateBody(BaseModel):
    title: str | None = None
    shootDate: str | None = None
    theme: str | None = None
    location: str | None = None
    tags: list[str] | None = None
    usage: str | None = None


class AssetBatchBody(BaseModel):
    assetIds: list[int]
    tags: list[str] = []
    usage: str | None = None


class RevisionItemBody(BaseModel):
    message: str
    timecode: str | None = None


class RevisionBatchBody(BaseModel):
    items: list[RevisionItemBody]


class AssetMemoBody(BaseModel):
    text: str


class AdminAccountCreateBody(BaseModel):
    account: str
    displayName: str
    role: str
    temporaryPassword: str | None = None


class AdminAccountUpdateBody(BaseModel):
    displayName: str | None = None
    active: bool | None = None
    role: str | None = None


class AdminPasswordResetBody(BaseModel):
    temporaryPassword: str | None = None


PACKAGE_STATUSES = {
    "UPLOADING", "DRAFT", "PENDING_EDIT", "EDITING", "PENDING_REVIEW",
    "REVISION_REQUESTED", "REVISING", "COMPLETED", "ARCHIVED",
}
THEMES = {"未分类", "日常素材", "工作日常", "机场接送", "京都包车", "大阪包车", "车辆介绍", "客人接待", "景点素材", "其他"}
STATUS_TRANSITIONS = {
    "DRAFT": {"PENDING_EDIT"},
    "UPLOADING": {"DRAFT"},
    "PENDING_EDIT": {"EDITING"},
    "EDITING": {"PENDING_REVIEW"},
    "PENDING_REVIEW": {"REVISION_REQUESTED", "COMPLETED"},
    "REVISION_REQUESTED": {"REVISING"},
    "REVISING": {"PENDING_REVIEW"},
    "COMPLETED": {"ARCHIVED"},
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def audit(conn, actor_id: int, action: str, object_type: str, object_id: int | None, detail: str = "", *, result: str = "success", ip_address: str | None = None, before_value: str | None = None, after_value: str | None = None):
    conn.execute(
        "INSERT INTO audit_logs(actor_id,action,object_type,object_id,detail,created_at,result,ip_address,before_value,after_value) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (actor_id, action, object_type, object_id, detail[:500], utc_now(), result, ip_address, before_value, after_value),
    )


def notify_roles(conn, roles: tuple[str, ...], package_id: int, event_type: str, message: str):
    placeholders = ",".join("?" for _ in roles)
    users = conn.execute(f"SELECT id FROM users WHERE active=1 AND role IN ({placeholders})", roles).fetchall()
    now = utc_now()
    conn.executemany(
        "INSERT INTO notifications(user_id,package_id,event_type,message,created_at) VALUES(?,?,?,?,?)",
        [(row["id"], package_id, event_type, message, now) for row in users],
    )


def package_for_access(conn, package_id: int, user, require_submitted: bool = False):
    row = conn.execute("SELECT p.*,u.account driver_code,u.display_name driver_name FROM material_packages p JOIN users u ON u.id=p.driver_id WHERE p.id=?", (package_id,)).fetchone()
    if not row:
        raise HTTPException(404, "material package not found")
    if user["role"] == "driver" and row["driver_id"] != user["id"]:
        raise HTTPException(403, "access denied")
    if require_submitted and user["role"] == "editor" and row["status"] in ("DRAFT", "UPLOADING"):
        raise HTTPException(403, "package has not been submitted")
    return row


def transition_package(conn, package, target: str, user, allowed_roles: tuple[str, ...]):
    if user["role"] not in allowed_roles:
        raise HTTPException(403, "operation not permitted for this role")
    current = package["status"]
    if target not in STATUS_TRANSITIONS.get(current, set()):
        raise HTTPException(409, f"invalid status transition: {current} -> {target}")
    now = utc_now()
    conn.execute("UPDATE material_packages SET status=?,updated_at=? WHERE id=?", (target, now, package["id"]))
    conn.execute("INSERT INTO package_status_history(package_id,from_status,to_status,actor_id,created_at) VALUES(?,?,?,?,?)", (package["id"], current, target, user["id"], now))
    audit(conn, user["id"], "status_change", "material_package", package["id"], f"{current}->{target}")


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


def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "administrator access required")
    return user


def require_super_admin(user=Depends(require_admin)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "super administrator access required")
    return user


ROLE_INPUT = {"UPLOADER": "driver", "EDITOR": "editor", "ADMIN": "admin", "driver": "driver", "editor": "editor", "admin": "admin"}
ROLE_OUTPUT = {"driver": "UPLOADER", "editor": "EDITOR", "admin": "ADMIN"}


def normalized_role(value: str) -> str:
    role = ROLE_INPUT.get(value.strip())
    if not role:
        raise HTTPException(400, "invalid role")
    return role


def validate_temporary_password(value: str | None) -> str:
    password = value or secrets.token_urlsafe(14)
    if len(password) < 12:
        raise HTTPException(400, "temporary password must contain at least 12 characters")
    return password


@app.get("/health")
def health():
    return {"status": "ok", "service": "daitora-vlog-box-api"}


@app.post("/v1/auth/login")
def login(body: LoginBody, request: Request):
    account = body.account.strip()
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(account)=lower(?) AND active=1", (account,)).fetchone()
        if not row or not password_matches(body.password, row["password_hash"]):
            time.sleep(0.35)
            raise HTTPException(401, "账号或密码不正确")
        token = secrets.token_urlsafe(40)
        conn.execute("DELETE FROM sessions WHERE expires_at<=?", (int(time.time()),))
        now = utc_now()
        conn.execute("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], int(time.time()) + TOKEN_TTL_SECONDS, now))
        conn.execute("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?", (now, now, row["id"]))
        audit(conn, row["id"], "login", "session", None, "login succeeded", ip_address=request.client.host if request.client else None)
    return {"token": token, "user": {"id": row["account"], "name": row["display_name"], "role": row["role"], "isSuperAdmin": bool(row["is_super_admin"]), "mustChangePassword": bool(row["must_change_password"])}}


@app.get("/v1/me")
def me(user=Depends(current_user)):
    return {"id": user["account"], "name": user["display_name"], "role": user["role"], "isSuperAdmin": bool(user["is_super_admin"]), "mustChangePassword": bool(user["must_change_password"])}


@app.post("/v1/me/profile")
def update_profile(body: ProfileBody, user=Depends(current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "name is required")
    if len(name) > 30:
        raise HTTPException(400, "name is too long")
    with db() as conn:
        conn.execute("UPDATE users SET display_name=? WHERE id=?", (name, user["id"]))
    return {"id": user["account"], "name": name, "role": user["role"]}


PACKAGE_SELECT = """
SELECT p.*,u.account driver_code,u.display_name driver_name,
 COUNT(DISTINCT a.id) file_count,
 SUM(CASE WHEN a.media_type='video' THEN 1 ELSE 0 END) video_count,
 SUM(CASE WHEN a.media_type='image' THEN 1 ELSE 0 END) image_count,
 COALESCE(SUM(a.size_bytes),0) size_bytes,
 MAX(a.uploaded_at) latest_upload
FROM material_packages p JOIN users u ON u.id=p.driver_id
LEFT JOIN assets a ON a.package_id=p.id
"""


def package_response(row):
    shoot_date = (row["shoot_date"] or "").strip()
    effective_date = shoot_date or ((row["latest_upload"] or row["created_at"] or "")[:10])
    return {
        "id": row["id"], "driverCode": row["driver_code"], "driver": row["driver_name"],
        "title": row["title"], "shootDate": row["shoot_date"], "theme": row["theme"],
        "location": row["location"], "tags": json.loads(row["tags"] or "[]"), "usage": row["usage"],
        "effectiveDate": effective_date, "dateSource": "shoot_date" if shoot_date else "uploaded_at",
        "status": row["status"], "createdAt": row["created_at"], "submittedAt": row["submitted_at"],
        "updatedAt": row["updated_at"], "legacy": bool(row["legacy"]),
        "fileCount": row["file_count"], "videoCount": row["video_count"],
        "imageCount": row["image_count"], "sizeBytes": row["size_bytes"],
    }


@app.post("/v1/material-packages")
def create_material_package(body: PackageCreateBody, user=Depends(current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "driver access required")
    if body.theme not in THEMES:
        raise HTTPException(400, "invalid theme")
    try:
        datetime.strptime(body.shootDate, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(400, "shootDate must be YYYY-MM-DD") from exc
    title = body.title.strip()
    if not title or len(title) > 100:
        raise HTTPException(400, "invalid title")
    now = utc_now()
    with db() as conn:
        cursor = conn.execute("INSERT INTO material_packages(driver_id,title,shoot_date,theme,location,tags,usage,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (user["id"], title, body.shootDate, body.theme, body.location.strip()[:100], json.dumps(body.tags[:20], ensure_ascii=False), body.usage.strip()[:100], "DRAFT", now, now))
        package_id = cursor.lastrowid
        audit(conn, user["id"], "create", "material_package", package_id, title)
        row = conn.execute(f"{PACKAGE_SELECT} WHERE p.id=? GROUP BY p.id", (package_id,)).fetchone()
    return package_response(row)


@app.get("/v1/material-packages")
def list_material_packages(status: str | None = None, driver_id: str | None = None, query: str | None = None, theme: str | None = None, location: str | None = None, usage: str | None = None, tag: str | None = None, sort: str = "priority", page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100), user=Depends(current_user)):
    clauses, params = ["1=1"], []
    if user["role"] == "driver":
        clauses.append("p.driver_id=?"); params.append(user["id"])
    elif user["role"] == "editor":
        clauses.append("p.status NOT IN ('DRAFT','UPLOADING')")
    if status:
        if status not in PACKAGE_STATUSES: raise HTTPException(400, "invalid status")
        clauses.append("p.status=?"); params.append(status)
    if driver_id and user["role"] != "driver":
        clauses.append("u.account=?"); params.append(driver_id)
    if query:
        clauses.append("(p.title LIKE ? OR u.account LIKE ? OR u.display_name LIKE ? OR p.location LIKE ? OR p.tags LIKE ?)")
        params.extend([f"%{query}%"] * 5)
    for column, value in (("p.theme", theme), ("p.location", location), ("p.usage", usage)):
        if value: clauses.append(f"{column} LIKE ?"); params.append(f"%{value}%")
    if tag: clauses.append("p.tags LIKE ?"); params.append(f'%"{tag}"%')
    priority = "CASE p.status WHEN 'REVISION_REQUESTED' THEN 0 WHEN 'PENDING_EDIT' THEN 1 ELSE 2 END"
    package_date = "COALESCE(NULLIF(p.shoot_date,''),substr(MAX(a.uploaded_at),1,10),substr(p.created_at,1,10))"
    orders = {"priority": f"{priority},COALESCE(p.submitted_at,p.created_at),p.updated_at DESC", "newest": f"{package_date} DESC,p.updated_at DESC", "oldest": f"{package_date},p.updated_at", "size": "size_bytes DESC", "files": "file_count DESC"}
    if sort not in orders: raise HTTPException(400, "invalid sort")
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM material_packages p JOIN users u ON u.id=p.driver_id WHERE {' AND '.join(clauses)}", params).fetchone()[0]
        rows = conn.execute(f"{PACKAGE_SELECT} WHERE {' AND '.join(clauses)} GROUP BY p.id ORDER BY {orders[sort]} LIMIT ? OFFSET ?", [*params, page_size, (page-1)*page_size]).fetchall()
    return {"items": [package_response(row) for row in rows], "page": page, "pageSize": page_size, "total": total}


@app.post("/v1/material-packages/{package_id}/metadata")
def update_material_package(package_id: int, body: PackageUpdateBody, user=Depends(current_user)):
    with db() as conn:
        package = package_for_access(conn, package_id, user)
        if user["role"] == "driver" and package["status"] not in ("DRAFT", "UPLOADING"):
            raise HTTPException(409, "submitted package metadata cannot be changed")
        values = {"title": body.title, "shoot_date": body.shootDate, "theme": body.theme, "location": body.location, "usage": body.usage}
        if body.theme is not None and body.theme not in THEMES: raise HTTPException(400, "invalid theme")
        updates, params = [], []
        for column, value in values.items():
            if value is not None: updates.append(f"{column}=?"); params.append(value.strip()[:100])
        if body.tags is not None: updates.append("tags=?"); params.append(json.dumps(body.tags[:20], ensure_ascii=False))
        if not updates: raise HTTPException(400, "no metadata supplied")
        updates.append("updated_at=?"); params.append(utc_now()); params.append(package_id)
        conn.execute(f"UPDATE material_packages SET {','.join(updates)} WHERE id=?", params)
        audit(conn, user["id"], "update", "material_package", package_id, ",".join(updates))
        row = conn.execute(f"{PACKAGE_SELECT} WHERE p.id=? GROUP BY p.id", (package_id,)).fetchone()
    return package_response(row)


@app.get("/v1/material-packages/{package_id}")
def material_package_detail(package_id: int, user=Depends(current_user)):
    with db() as conn:
        package_for_access(conn, package_id, user, True)
        row = conn.execute(f"{PACKAGE_SELECT} WHERE p.id=? GROUP BY p.id", (package_id,)).fetchone()
        assets = conn.execute("SELECT id,original_name,media_type,mime_type,size_bytes,uploaded_at,upload_status,memo_text,memo_voice_name IS NOT NULL has_voice_memo,memo_voice_size,memo_updated_at FROM assets WHERE package_id=? ORDER BY uploaded_at", (package_id,)).fetchall()
        products = conn.execute("SELECT id,title,original_name,size_bytes,uploaded_at,status,version_number,version_note,duration_seconds,resolution,is_current,is_final FROM finished_products WHERE package_id=? ORDER BY version_number", (package_id,)).fetchall()
        revisions = conn.execute("SELECT id,product_id,message,timecode,created_at,status,reply,replied_at,resolved_at FROM revisions WHERE product_id IN (SELECT id FROM finished_products WHERE package_id=?) ORDER BY created_at", (package_id,)).fetchall()
        history = conn.execute("SELECT h.*,u.display_name actor FROM package_status_history h JOIN users u ON u.id=h.actor_id WHERE package_id=? ORDER BY created_at", (package_id,)).fetchall()
    result = package_response(row); result.update(assets=[dict(x) for x in assets], products=[dict(x) for x in products], revisions=[dict(x) for x in revisions], history=[dict(x) for x in history])
    return result


@app.post("/v1/material-packages/{package_id}/submit")
def submit_material_package(package_id: int, user=Depends(current_user)):
    with db() as conn:
        package = package_for_access(conn, package_id, user)
        if user["role"] != "driver" or package["driver_id"] != user["id"]: raise HTTPException(403, "driver access required")
        pending = conn.execute("SELECT COUNT(*) FROM assets WHERE package_id=? AND upload_status!='completed'", (package_id,)).fetchone()[0]
        count = conn.execute("SELECT COUNT(*) FROM assets WHERE package_id=?", (package_id,)).fetchone()[0]
        if count == 0: raise HTTPException(409, "empty package cannot be submitted")
        if pending: raise HTTPException(409, "uploads are not complete")
        transition_package(conn, package, "PENDING_EDIT", user, ("driver",))
        now = utc_now(); conn.execute("UPDATE material_packages SET submitted_at=? WHERE id=?", (now, package_id))
        notify_roles(conn, ("editor", "admin"), package_id, "NEW_PACKAGE", f"{user['display_name']}提交了新素材包")
    return {"id": package_id, "status": "PENDING_EDIT"}


@app.post("/v1/material-packages/{package_id}/start-editing")
def start_editing(package_id: int, user=Depends(require_editor)):
    with db() as conn:
        package = package_for_access(conn, package_id, user, True)
        transition_package(conn, package, "EDITING", user, ("editor", "admin"))
    return {"id": package_id, "status": "EDITING"}


@app.post("/v1/material-packages/{package_id}/start-revision")
def start_revision(package_id: int, user=Depends(require_editor)):
    with db() as conn:
        package = package_for_access(conn, package_id, user, True)
        transition_package(conn, package, "REVISING", user, ("editor", "admin"))
    return {"id": package_id, "status": "REVISING"}


@app.post("/v1/material-packages/{package_id}/confirm")
def confirm_material_package(package_id: int, user=Depends(current_user)):
    if user["role"] != "driver": raise HTTPException(403, "driver access required")
    with db() as conn:
        package = package_for_access(conn, package_id, user)
        transition_package(conn, package, "COMPLETED", user, ("driver",))
        conn.execute("UPDATE finished_products SET is_final=1 WHERE package_id=? AND is_current=1", (package_id,))
        audit(conn,user["id"],"confirm","material_package",package_id)
    return {"id": package_id, "status": "COMPLETED"}


@app.post("/v1/material-packages/{package_id}/archive")
def archive_material_package(package_id: int, user=Depends(require_editor)):
    with db() as conn:
        package = package_for_access(conn, package_id, user, True)
        transition_package(conn, package, "ARCHIVED", user, ("editor", "admin"))
    return {"id":package_id,"status":"ARCHIVED"}


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
            files = conn.execute(f"SELECT id,original_name,media_type,mime_type,size_bytes,uploaded_at,memo_text,memo_voice_name IS NOT NULL has_voice_memo,memo_voice_size,memo_updated_at FROM assets a WHERE driver_id=? ORDER BY {order} LIMIT 100", (driver["id"],)).fetchall()
            result.append({"id": f"DRIVER-{driver['account']}", "driver": driver["display_name"], "code": driver["account"], "count": driver["count"], "sizeBytes": driver["size_bytes"], "latestUpload": driver["latest"], "files": [dict(item) for item in files]})
    return {"items": result}


@app.post("/v1/assets/upload")
async def upload_asset(file: Annotated[UploadFile, File()], driver_code: Annotated[str | None, Form()] = None, package_id: Annotated[int | None, Form()] = None, memo_text: Annotated[str | None, Form()] = None, duration: Annotated[float | None, Form()] = None, width: Annotated[int | None, Form()] = None, height: Annotated[int | None, Form()] = None, user=Depends(current_user)):
    target_code = user["account"] if user["role"] == "driver" else (driver_code or "")
    if user["role"] != "driver" and not target_code:
        raise HTTPException(400, "driver_code is required")
    with db() as conn:
        driver = conn.execute("SELECT * FROM users WHERE account=? AND role='driver' AND active=1", (target_code,)).fetchone()
        if not driver:
            raise HTTPException(404, "upload user not found")
        if package_id is not None:
            package = package_for_access(conn, package_id, user)
            allowed = ("DRAFT", "UPLOADING", "PENDING_EDIT", "EDITING", "PENDING_REVIEW", "REVISION_REQUESTED", "REVISING")
            if package["driver_id"] != driver["id"] or package["status"] not in allowed:
                raise HTTPException(409, "package does not accept uploads")
    safe_suffix = Path(file.filename or "upload.bin").suffix.lower()[:12]
    stored_name = f"{driver['account']}_{int(time.time())}_{secrets.token_hex(8)}{safe_suffix}"
    destination = UPLOAD_DIR / stored_name
    size = 0
    try:
        with destination.open("xb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if MAX_UPLOAD_BYTES > 0 and size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "file too large")
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    media_type = "video" if (file.content_type or "").startswith("video/") else "image" if (file.content_type or "").startswith("image/") else "file"
    uploaded_at = datetime.now(timezone.utc).isoformat()
    orientation = "unknown"
    if width and height: orientation = "landscape" if width > height else "portrait" if height > width else "square"
    with db() as conn:
        memo = (memo_text or "").strip()[:500]
        cursor = conn.execute("INSERT INTO assets(driver_id,uploader_id,package_id,original_name,stored_name,media_type,mime_type,size_bytes,uploaded_at,upload_status,memo_text,memo_updated_at,duration_seconds,width,height,orientation,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (driver["id"], user["id"], package_id, file.filename or stored_name, stored_name, media_type, file.content_type or "application/octet-stream", size, uploaded_at, "completed", memo, uploaded_at if memo else None, duration, width, height, orientation, uploaded_at))
        asset_id = cursor.lastrowid
        if package_id is not None:
            conn.execute("UPDATE material_packages SET updated_at=? WHERE id=?", (uploaded_at, package_id))
            audit(conn, user["id"], "upload", "asset", asset_id, file.filename or stored_name)
    return {"id": asset_id, "packageId": package_id, "name": file.filename, "type": media_type, "sizeBytes": size, "uploadedAt": uploaded_at, "memoText": memo, "hasVoiceMemo": False}


@app.get("/v1/assets")
def list_assets(package_id: int | None = None, driver_id: str | None = None, media_type: str | None = None, orientation: str | None = None, query: str | None = None, theme: str | None = None, location: str | None = None, tag: str | None = None, status: str | None = None, date_from: str | None = None, date_to: str | None = None, sort: str = "newest", page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100), user=Depends(current_user)):
    clauses, params = ["1=1"], []
    if user["role"] == "driver": clauses.append("a.driver_id=?"); params.append(user["id"])
    elif user["role"] == "editor": clauses.append("p.status NOT IN ('DRAFT','UPLOADING')")
    if package_id is not None:
        with db() as conn: package_for_access(conn, package_id, user, user["role"] == "editor")
        clauses.append("a.package_id=?"); params.append(package_id)
    if driver_id and user["role"] != "driver": clauses.append("u.account=?"); params.append(driver_id)
    if media_type: clauses.append("a.media_type=?"); params.append(media_type)
    if orientation: clauses.append("a.orientation=?"); params.append(orientation)
    if query: clauses.append("(a.original_name LIKE ? OR a.memo_text LIKE ? OR p.title LIKE ?)"); params.extend([f"%{query}%"]*3)
    if theme: clauses.append("p.theme=?"); params.append(theme)
    if location: clauses.append("p.location LIKE ?"); params.append(f"%{location}%")
    if tag: clauses.append("p.tags LIKE ?"); params.append(f'%"{tag}"%')
    if status: clauses.append("p.status=?"); params.append(status)
    effective_date = "COALESCE(NULLIF(p.shoot_date,''),substr(a.uploaded_at,1,10))"
    if date_from: clauses.append(f"{effective_date}>=?"); params.append(date_from)
    if date_to: clauses.append(f"{effective_date}<=?"); params.append(date_to)
    orders = {"newest":f"{effective_date} DESC,a.uploaded_at DESC", "oldest":f"{effective_date},a.uploaded_at", "name":"a.original_name COLLATE NOCASE", "size":"a.size_bytes DESC", "type":"a.media_type,a.original_name COLLATE NOCASE"}
    if sort not in orders: raise HTTPException(400, "invalid sort")
    base = "FROM assets a JOIN users u ON u.id=a.driver_id LEFT JOIN material_packages p ON p.id=a.package_id"
    fields = f"a.id,a.package_id,a.original_name,a.media_type,a.mime_type,a.size_bytes,a.uploaded_at,a.upload_status,a.memo_text,a.duration_seconds,a.width,a.height,a.orientation,a.thumbnail_key,u.account user_account,u.display_name user_name,p.title package_title,p.theme,p.location,p.tags,p.usage,p.status package_status,p.shoot_date,{effective_date} effective_date,CASE WHEN NULLIF(p.shoot_date,'') IS NULL THEN 'uploaded_at' ELSE 'shoot_date' END date_source"
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) {base} WHERE {' AND '.join(clauses)}", params).fetchone()[0]
        rows = conn.execute(f"SELECT {fields} {base} WHERE {' AND '.join(clauses)} ORDER BY {orders[sort]} LIMIT ? OFFSET ?", [*params,page_size,(page-1)*page_size]).fetchall()
    return {"items":[dict(row) for row in rows],"page":page,"pageSize":page_size,"total":total}


@app.get("/v1/library/stats")
def library_stats(driver_id: str | None = None, user=Depends(require_editor)):
    clause, params = "", []
    if driver_id: clause=" AND u.account=?"; params.append(driver_id)
    with db() as conn:
        users = conn.execute(f"SELECT COUNT(*) FROM users u WHERE u.role='driver' AND u.active=1{clause}",params).fetchone()[0]
        packages = conn.execute(f"SELECT COUNT(*) FROM material_packages p JOIN users u ON u.id=p.driver_id WHERE 1=1{clause}",params).fetchone()[0]
        files = conn.execute(f"SELECT COUNT(*) FROM assets a JOIN users u ON u.id=a.driver_id WHERE 1=1{clause}",params).fetchone()[0]
    return {"userCount":users,"packageCount":packages,"fileCount":files}


@app.post("/v1/assets/batch-classify")
def batch_classify_assets(body: AssetBatchBody, user=Depends(require_editor)):
    ids = list(dict.fromkeys(body.assetIds))[:200]
    if not ids: raise HTTPException(400, "assetIds required")
    placeholders = ",".join("?" for _ in ids)
    with db() as conn:
        package_ids = [row[0] for row in conn.execute(f"SELECT DISTINCT package_id FROM assets WHERE id IN ({placeholders}) AND package_id IS NOT NULL", ids)]
        for package_id in package_ids:
            updates, params = ["tags=?"], [json.dumps(body.tags[:20], ensure_ascii=False)]
            if body.usage is not None: updates.append("usage=?"); params.append(body.usage.strip()[:100])
            params.extend([utc_now(), package_id]); conn.execute(f"UPDATE material_packages SET {','.join(updates)},updated_at=? WHERE id=?", params)
        audit(conn,user["id"],"batch_classify","asset",None,f"{len(ids)} assets")
    return {"updated":len(ids),"packageIds":package_ids}


def asset_for_memo(conn, asset_id: int, user):
    row = conn.execute("SELECT a.*,p.status package_status FROM assets a LEFT JOIN material_packages p ON p.id=a.package_id WHERE a.id=?", (asset_id,)).fetchone()
    if not row: raise HTTPException(404, "asset not found")
    if user["role"] == "driver" and row["driver_id"] != user["id"]: raise HTTPException(403, "access denied")
    return row


@app.post("/v1/assets/{asset_id}/memo")
def update_asset_memo(asset_id: int, body: AssetMemoBody, user=Depends(current_user)):
    text = body.text.strip()
    if len(text) > 500: raise HTTPException(400, "memo is too long")
    with db() as conn:
        row = asset_for_memo(conn, asset_id, user)
        if user["role"] == "driver" and row["package_status"] not in ("DRAFT", "UPLOADING"): raise HTTPException(409, "submitted asset memo cannot be changed")
        now = utc_now(); conn.execute("UPDATE assets SET memo_text=?,memo_updated_at=? WHERE id=?", (text, now, asset_id)); audit(conn,user["id"],"update_memo","asset",asset_id)
    return {"id":asset_id,"memoText":text,"memoUpdatedAt":now}


@app.post("/v1/assets/{asset_id}/voice-memo")
async def upload_asset_voice_memo(asset_id: int, file: Annotated[UploadFile, File()], user=Depends(current_user)):
    with db() as conn:
        row = asset_for_memo(conn, asset_id, user)
        if user["role"] == "driver" and row["package_status"] not in ("DRAFT", "UPLOADING"): raise HTTPException(409, "submitted asset memo cannot be changed")
    if not (file.content_type or "").startswith("audio/"): raise HTTPException(400, "audio file required")
    suffix = Path(file.filename or "memo.mp3").suffix.lower()[:10] or ".mp3"
    stored_name = f"memo_{asset_id}_{int(time.time())}_{secrets.token_hex(6)}{suffix}"
    destination = MEMO_DIR / stored_name; size = 0
    try:
        with destination.open("xb") as output:
            while chunk := await file.read(256 * 1024):
                size += len(chunk)
                if size > 10 * 1024 * 1024: raise HTTPException(413, "voice memo too large")
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True); raise
    now = utc_now()
    with db() as conn:
        conn.execute("UPDATE assets SET memo_voice_name=?,memo_voice_mime=?,memo_voice_size=?,memo_updated_at=? WHERE id=?", (stored_name,file.content_type or "audio/mpeg",size,now,asset_id)); audit(conn,user["id"],"upload_voice_memo","asset",asset_id,str(size))
    return {"id":asset_id,"hasVoiceMemo":True,"voiceMemoSize":size,"memoUpdatedAt":now}


@app.get("/v1/assets/{asset_id}/voice-memo")
def download_asset_voice_memo(asset_id: int, user=Depends(current_user)):
    with db() as conn: row = asset_for_memo(conn, asset_id, user)
    if not row["memo_voice_name"]: raise HTTPException(404, "voice memo not found")
    path = MEMO_DIR / row["memo_voice_name"]
    if not path.is_file(): raise HTTPException(410, "voice memo file missing")
    return FileResponse(path, media_type=row["memo_voice_mime"] or "audio/mpeg", filename=f"memo-{asset_id}{path.suffix}")


@app.delete("/v1/assets/{asset_id}")
def delete_draft_asset(asset_id: int, user=Depends(current_user)):
    with db() as conn:
        row = conn.execute("SELECT a.*,p.status package_status FROM assets a JOIN material_packages p ON p.id=a.package_id WHERE a.id=?", (asset_id,)).fetchone()
        if not row: raise HTTPException(404, "asset not found")
        if user["role"] != "driver" or row["driver_id"] != user["id"]: raise HTTPException(403, "access denied")
        if row["package_status"] not in ("DRAFT", "UPLOADING"): raise HTTPException(409, "submitted assets cannot be deleted")
        conn.execute("DELETE FROM assets WHERE id=?", (asset_id,)); audit(conn, user["id"], "delete", "asset", asset_id, row["original_name"])
    (UPLOAD_DIR / row["stored_name"]).unlink(missing_ok=True)
    if row["memo_voice_name"]:
        (MEMO_DIR / row["memo_voice_name"]).unlink(missing_ok=True)
    return {"deleted": True}


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


@app.get("/v1/assets/{asset_id}/preview")
def preview_asset(asset_id: int, user=Depends(current_user)):
    with db() as conn: row = asset_for_memo(conn, asset_id, user)
    path = UPLOAD_DIR / row["stored_name"]
    if not path.is_file(): raise HTTPException(410, "stored file missing")
    return FileResponse(path, media_type=row["mime_type"], headers={"Content-Disposition": f'inline; filename="asset-{asset_id}{path.suffix}"', "Accept-Ranges":"bytes"})


@app.get("/v1/material-packages/{package_id}/download")
def download_material_package(package_id: int, user=Depends(current_user)):
    with db() as conn:
        package = package_for_access(conn, package_id, user, user["role"] == "editor")
        rows = conn.execute("SELECT original_name,stored_name FROM assets WHERE package_id=? AND upload_status='completed' ORDER BY uploaded_at", (package_id,)).fetchall()
    if not rows: raise HTTPException(409, "package has no downloadable files")
    handle, archive_name = tempfile.mkstemp(prefix=f"package-{package_id}-", suffix=".zip", dir=DATA_DIR)
    os.close(handle)
    try:
        used: set[str] = set()
        with zipfile.ZipFile(archive_name, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for index, row in enumerate(rows, 1):
                source = UPLOAD_DIR / row["stored_name"]
                if not source.is_file(): continue
                name = Path(row["original_name"]).name or f"asset-{index}"
                if name in used: name = f"{index}-{name}"
                used.add(name); archive.write(source, arcname=name)
        audit_conn = db()
        with audit_conn: audit(audit_conn,user["id"],"download","material_package",package_id,str(len(used)))
        return FileResponse(archive_name, media_type="application/zip", filename=f"{package['title'][:60]}.zip", background=BackgroundTask(Path(archive_name).unlink, missing_ok=True))
    except Exception:
        Path(archive_name).unlink(missing_ok=True)
        raise


@app.post("/v1/finished-products/upload")
async def upload_finished_product(
    file: Annotated[UploadFile, File()],
    package_id: Annotated[int, Form()],
    title: Annotated[str | None, Form()] = None,
    version_note: Annotated[str | None, Form()] = None,
    user=Depends(require_editor),
):
    with db() as conn:
        package = package_for_access(conn, package_id, user, True)
        if package["status"] not in ("EDITING", "REVISING"):
            raise HTTPException(409, "package is not ready for product upload")
        owner = conn.execute("SELECT * FROM users WHERE id=? AND role='driver' AND active=1", (package["driver_id"],)).fetchone()
        if not owner: raise HTTPException(409, "package owner is unavailable")
    safe_suffix = Path(file.filename or "finished.mp4").suffix.lower()[:12]
    stored_name = f"finished_{owner['account']}_{int(time.time())}_{secrets.token_hex(8)}{safe_suffix}"
    destination = FINISHED_DIR / stored_name
    size = 0
    try:
        with destination.open("xb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if MAX_UPLOAD_BYTES > 0 and size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "file too large")
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    uploaded_at = datetime.now(timezone.utc).isoformat()
    product_title = (title or Path(file.filename or "成品").stem).strip() or "成品"
    with db() as conn:
        version_number = conn.execute("SELECT COALESCE(MAX(version_number),0)+1 FROM finished_products WHERE package_id=?", (package_id,)).fetchone()[0]
        conn.execute("UPDATE finished_products SET is_current=0 WHERE package_id=?", (package_id,))
        cursor = conn.execute(
            "INSERT INTO finished_products(driver_id,uploader_id,package_id,title,original_name,stored_name,mime_type,size_bytes,uploaded_at,status,version_number,version_note,is_current) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)",
            (owner["id"], user["id"], package_id, product_title, file.filename or stored_name, stored_name, file.content_type or "application/octet-stream", size, uploaded_at, "pending", version_number, (version_note or "")[:300]),
        )
        product_id = cursor.lastrowid
        transition_package(conn, package, "PENDING_REVIEW", user, ("editor", "admin"))
        conn.execute("UPDATE revisions SET status='resolved',resolved_by=?,resolved_at=? WHERE product_id IN (SELECT id FROM finished_products WHERE package_id=? AND id!=?) AND status='pending'", (user["id"], uploaded_at, package_id, product_id))
        conn.execute("INSERT INTO notifications(user_id,package_id,event_type,message,created_at) VALUES(?,?,?,?,?)", (owner["id"], package_id, "PRODUCT_READY", f"{product_title} V{version_number}待确认", uploaded_at))
        audit(conn, user["id"], "upload", "finished_product", product_id, f"package={package_id};owner={owner['account']};V{version_number}")
    return {"id": product_id, "packageId": package_id, "versionNumber": version_number, "ownerAccount": owner["account"], "title": product_title, "originalName": file.filename, "sizeBytes": size, "uploadedAt": uploaded_at, "status": "pending"}


def finished_product_response(row):
    return {
        "id": row["id"],
        "packageId": row["package_id"],
        "packageTitle": row["package_title"] if "package_title" in row.keys() else None,
        "driverCode": row["driver_code"],
        "driver": row["driver_name"],
        "title": row["title"],
        "originalName": row["original_name"],
        "mimeType": row["mime_type"],
        "sizeBytes": row["size_bytes"],
        "uploadedAt": row["uploaded_at"],
        "status": row["status"],
        "versionNumber": row["version_number"],
        "versionNote": row["version_note"],
        "isCurrent": bool(row["is_current"]),
        "isFinal": bool(row["is_final"]),
        "downloadUrl": f"/v1/finished-products/{row['id']}/download",
    }


@app.get("/v1/finished-products")
def list_finished_products(driver_id: str | None = None, query: str | None = None, status: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100), user=Depends(require_editor)):
    where = "WHERE 1=1"
    params = []
    if driver_id:
        where += " AND u.account=?"
        params.append(driver_id)
    if query:
        where += " AND (f.title LIKE ? OR f.original_name LIKE ? OR u.account LIKE ? OR u.display_name LIKE ? OR p.title LIKE ?)"
        params.extend([f"%{query}%"]*5)
    if status: where += " AND f.status=?"; params.append(status)
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM finished_products f JOIN users u ON u.id=f.driver_id LEFT JOIN material_packages p ON p.id=f.package_id {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT f.*,u.account driver_code,u.display_name driver_name,p.title package_title FROM finished_products f JOIN users u ON u.id=f.driver_id LEFT JOIN material_packages p ON p.id=f.package_id {where} ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?",
            [*params,page_size,(page-1)*page_size],
        ).fetchall()
    return {"items": [finished_product_response(row) for row in rows],"page":page,"pageSize":page_size,"total":total}


@app.get("/v1/me/latest-finished-product")
def latest_finished_product(user=Depends(current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "driver access required")
    with db() as conn:
        row = conn.execute(
            "SELECT f.*,u.account driver_code,u.display_name driver_name FROM finished_products f JOIN users u ON u.id=f.driver_id WHERE f.driver_id=? ORDER BY f.uploaded_at DESC LIMIT 1",
            (user["id"],),
        ).fetchone()
    return {"item": finished_product_response(row) if row else None}


@app.get("/v1/finished-products/{product_id}/download")
def download_finished_product(product_id: int, user=Depends(current_user)):
    with db() as conn:
        row = conn.execute("SELECT * FROM finished_products WHERE id=?", (product_id,)).fetchone()
    if not row:
        raise HTTPException(404, "finished product not found")
    if user["role"] == "driver" and row["driver_id"] != user["id"]:
        raise HTTPException(403, "access denied")
    path = FINISHED_DIR / row["stored_name"]
    if not path.is_file():
        raise HTTPException(410, "stored file missing")
    with db() as conn: audit(conn,user["id"],"download","finished_product",product_id,row["original_name"])
    return FileResponse(path, media_type=row["mime_type"], filename=row["original_name"])


def revision_response(row):
    return {
        "id": row["id"],
        "productId": row["product_id"],
        "productTitle": row["product_title"],
        "driverCode": row["driver_code"],
        "driver": row["driver_name"],
        "message": row["message"],
        "createdAt": row["created_at"],
        "reply": row["reply"],
        "repliedAt": row["replied_at"],
        "status": row["status"],
    }


REVISION_SELECT = """
SELECT r.*,f.title product_title,u.account driver_code,u.display_name driver_name
FROM revisions r
JOIN finished_products f ON f.id=r.product_id
JOIN users u ON u.id=r.driver_id
"""


@app.post("/v1/finished-products/{product_id}/revisions")
def create_revision(product_id: int, body: MessageBody, user=Depends(current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "driver access required")
    message = body.message.strip()
    if not message:
        raise HTTPException(400, "message is required")
    with db() as conn:
        product = conn.execute("SELECT * FROM finished_products WHERE id=?", (product_id,)).fetchone()
        if not product:
            raise HTTPException(404, "finished product not found")
        if product["driver_id"] != user["id"]:
            raise HTTPException(403, "access denied")
        created_at = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute(
            "INSERT INTO revisions(product_id,driver_id,message,created_at,status) VALUES(?,?,?,?,?)",
            (product_id, user["id"], message, created_at, "pending"),
        )
        revision_id = cursor.lastrowid
        audit(conn,user["id"],"create","revision",revision_id,f"product={product_id}")
        conn.execute("UPDATE finished_products SET status='revision_requested' WHERE id=?", (product_id,))
        if product["package_id"]:
            package = package_for_access(conn, product["package_id"], user)
            transition_package(conn, package, "REVISION_REQUESTED", user, ("driver",))
            notify_roles(conn, ("editor", "admin"), product["package_id"], "REVISION_REQUESTED", f"{user['display_name']}提交了修改意见")
        row = conn.execute(f"{REVISION_SELECT} WHERE r.id=?", (revision_id,)).fetchone()
    return revision_response(row)


@app.post("/v1/finished-products/{product_id}/revision-items")
def create_revision_items(product_id: int, body: RevisionBatchBody, user=Depends(current_user)):
    if user["role"] != "driver": raise HTTPException(403, "driver access required")
    cleaned = [(item.message.strip(), (item.timecode or "").strip() or None) for item in body.items if item.message.strip()]
    if not cleaned: raise HTTPException(400, "at least one revision item is required")
    if len(cleaned) > 20: raise HTTPException(400, "too many revision items")
    with db() as conn:
        product = conn.execute("SELECT * FROM finished_products WHERE id=?", (product_id,)).fetchone()
        if not product: raise HTTPException(404, "finished product not found")
        if product["driver_id"] != user["id"]: raise HTTPException(403, "access denied")
        if not product["package_id"]: raise HTTPException(409, "legacy product does not support batch revisions")
        package = package_for_access(conn, product["package_id"], user)
        if package["status"] != "PENDING_REVIEW": raise HTTPException(409, "product is not pending review")
        now = utc_now()
        ids = []
        for message, timecode in cleaned:
            ids.append(conn.execute("INSERT INTO revisions(product_id,driver_id,message,timecode,created_at,status) VALUES(?,?,?,?,?,'pending')", (product_id, user["id"], message, timecode, now)).lastrowid)
        conn.execute("UPDATE finished_products SET status='revision_requested' WHERE id=?", (product_id,))
        transition_package(conn, package, "REVISION_REQUESTED", user, ("driver",))
        notify_roles(conn, ("editor", "admin"), product["package_id"], "REVISION_REQUESTED", f"{user['display_name']}提交了{len(ids)}条修改意见")
        audit(conn, user["id"], "create", "revision_batch", product_id, str(len(ids)))
    return {"ids": ids, "status": "REVISION_REQUESTED"}


@app.post("/v1/revisions/{revision_id}/resolve")
def resolve_revision(revision_id: int, user=Depends(require_editor)):
    with db() as conn:
        row = conn.execute("SELECT * FROM revisions WHERE id=?", (revision_id,)).fetchone()
        if not row: raise HTTPException(404, "revision not found")
        now = utc_now(); conn.execute("UPDATE revisions SET status='resolved',resolved_by=?,resolved_at=? WHERE id=?", (user["id"], now, revision_id))
        audit(conn, user["id"], "resolve", "revision", revision_id)
    return {"id": revision_id, "status": "resolved", "resolvedAt": now}


@app.get("/v1/notifications")
def list_notifications(user=Depends(current_user)):
    with db() as conn:
        rows = conn.execute("SELECT id,package_id,event_type,message,unread,created_at,read_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100", (user["id"],)).fetchall()
    return {"unreadCount": sum(row["unread"] for row in rows), "items": [dict(row) for row in rows]}


@app.post("/v1/notifications/{notification_id}/read")
def read_notification(notification_id: int, user=Depends(current_user)):
    with db() as conn:
        changed = conn.execute("UPDATE notifications SET unread=0,read_at=? WHERE id=? AND user_id=?", (utc_now(), notification_id, user["id"])).rowcount
    if not changed: raise HTTPException(404, "notification not found")
    return {"id": notification_id, "unread": False}


@app.get("/v1/dashboard")
def dashboard(user=Depends(require_editor)):
    with db() as conn:
        counts = {row["status"]: row["count"] for row in conn.execute("SELECT status,COUNT(*) count FROM material_packages GROUP BY status")}
        overdue = conn.execute("SELECT COUNT(*) FROM material_packages WHERE status='PENDING_EDIT' AND submitted_at < datetime('now','-24 hours')").fetchone()[0]
        completed_month = conn.execute("SELECT COUNT(*) FROM material_packages WHERE status='COMPLETED' AND updated_at>=date('now','start of month')").fetchone()[0]
    return {"pendingEdit": counts.get("PENDING_EDIT",0), "editing": counts.get("EDITING",0), "revisionRequested": counts.get("REVISION_REQUESTED",0), "pendingReview": counts.get("PENDING_REVIEW",0), "completedThisMonth": completed_month, "overdue24h": overdue}


def admin_account_response(row):
    return {
        "id": row["id"], "account": row["account"], "displayName": row["display_name"],
        "role": ROLE_OUTPUT[row["role"]], "active": bool(row["active"]),
        "isSuperAdmin": bool(row["is_super_admin"]), "mustChangePassword": bool(row["must_change_password"]),
        "createdAt": row["created_at"], "lastLoginAt": row["last_login_at"],
        "assetCount": row["asset_count"], "productCount": row["product_count"],
    }


ADMIN_ACCOUNT_SELECT = """
SELECT u.*,
 (SELECT COUNT(*) FROM assets a WHERE a.driver_id=u.id AND a.deleted_at IS NULL) asset_count,
 (SELECT COUNT(*) FROM finished_products f WHERE f.driver_id=u.id AND f.deleted_at IS NULL) product_count
FROM users u
"""


@app.get("/v1/admin/overview")
def admin_overview(user=Depends(require_admin)):
    with db() as conn:
        accounts = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        active_accounts = conn.execute("SELECT COUNT(*) FROM users WHERE active=1").fetchone()[0]
        packages = conn.execute("SELECT COUNT(*) FROM material_packages WHERE deleted_at IS NULL").fetchone()[0]
        assets = conn.execute("SELECT COUNT(*) FROM assets WHERE deleted_at IS NULL").fetchone()[0]
        products = conn.execute("SELECT COUNT(*) FROM finished_products WHERE deleted_at IS NULL").fetchone()[0]
        failed = conn.execute("SELECT COUNT(*) FROM assets WHERE upload_status NOT IN ('completed','uploaded') AND deleted_at IS NULL").fetchone()[0]
    return {"accounts": accounts, "activeAccounts": active_accounts, "packages": packages, "assets": assets, "products": products, "uploadExceptions": failed}


@app.get("/v1/admin/accounts")
def admin_accounts(query: str | None = None, role: str | None = None, status: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), user=Depends(require_admin)):
    clauses, params = ["1=1"], []
    if query:
        clauses.append("(u.account LIKE ? OR u.display_name LIKE ?)"); params.extend([f"%{query}%"] * 2)
    if role:
        clauses.append("u.role=?"); params.append(normalized_role(role))
    if status in ("active", "disabled"):
        clauses.append("u.active=?"); params.append(1 if status == "active" else 0)
    where = " AND ".join(clauses)
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM users u WHERE {where}", params).fetchone()[0]
        rows = conn.execute(f"{ADMIN_ACCOUNT_SELECT} WHERE {where} ORDER BY u.created_at DESC,u.id DESC LIMIT ? OFFSET ?", [*params, page_size, (page - 1) * page_size]).fetchall()
    return {"items": [admin_account_response(row) for row in rows], "total": total, "page": page, "pageSize": page_size}


@app.post("/v1/admin/accounts")
def admin_create_account(body: AdminAccountCreateBody, request: Request, user=Depends(require_admin)):
    role = normalized_role(body.role)
    if role == "admin" and not user["is_super_admin"]:
        raise HTTPException(403, "only a super administrator can create administrators")
    account, name = body.account.strip(), body.displayName.strip()
    if not account or len(account) > 50 or not name or len(name) > 50:
        raise HTTPException(400, "invalid account or display name")
    password = validate_temporary_password(body.temporaryPassword)
    now = utc_now()
    with db() as conn:
        if conn.execute("SELECT 1 FROM users WHERE lower(account)=lower(?)", (account,)).fetchone():
            raise HTTPException(409, "account already exists")
        cursor = conn.execute("INSERT INTO users(account,display_name,role,password_hash,active,created_at,updated_at,must_change_password,is_super_admin) VALUES(?,?,?,?,1,?,?,1,0)", (account, name, role, password_hash(password), now, now))
        audit(conn, user["id"], "create_account", "user", cursor.lastrowid, f"account={account};role={ROLE_OUTPUT[role]}", ip_address=request.client.host if request.client else None, after_value=json.dumps({"account": account, "displayName": name, "role": ROLE_OUTPUT[role]}, ensure_ascii=False))
        row = conn.execute(f"{ADMIN_ACCOUNT_SELECT} WHERE u.id=?", (cursor.lastrowid,)).fetchone()
    return {"account": admin_account_response(row), "temporaryPassword": password}


@app.patch("/v1/admin/accounts/{account_id}")
def admin_update_account(account_id: int, body: AdminAccountUpdateBody, request: Request, user=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id=?", (account_id,)).fetchone()
        if not target: raise HTTPException(404, "account not found")
        if target["role"] == "admin" and not user["is_super_admin"]: raise HTTPException(403, "only a super administrator can manage administrators")
        next_role = normalized_role(body.role) if body.role else target["role"]
        if next_role == "admin" and target["role"] != "admin" and not user["is_super_admin"]: raise HTTPException(403, "only a super administrator can grant administrator access")
        next_active = int(body.active) if body.active is not None else target["active"]
        if target["role"] == "admin" and target["active"] and (not next_active or next_role != "admin"):
            remaining = conn.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1 AND id!=?", (account_id,)).fetchone()[0]
            if remaining == 0: raise HTTPException(409, "cannot disable or demote the last active administrator")
            if target["is_super_admin"]:
                remaining_super = conn.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1 AND is_super_admin=1 AND id!=?", (account_id,)).fetchone()[0]
                if remaining_super == 0: raise HTTPException(409, "cannot disable or demote the last active super administrator")
        next_name = body.displayName.strip() if body.displayName is not None else target["display_name"]
        if not next_name or len(next_name) > 50: raise HTTPException(400, "invalid display name")
        now = utc_now()
        conn.execute("UPDATE users SET display_name=?,role=?,active=?,disabled_at=?,updated_at=? WHERE id=?", (next_name, next_role, next_active, None if next_active else now, now, account_id))
        if not next_active: conn.execute("DELETE FROM sessions WHERE user_id=?", (account_id,))
        before = {"displayName": target["display_name"], "role": ROLE_OUTPUT[target["role"]], "active": bool(target["active"])}
        after = {"displayName": next_name, "role": ROLE_OUTPUT[next_role], "active": bool(next_active)}
        audit(conn, user["id"], "update_account", "user", account_id, target["account"], ip_address=request.client.host if request.client else None, before_value=json.dumps(before, ensure_ascii=False), after_value=json.dumps(after, ensure_ascii=False))
        row = conn.execute(f"{ADMIN_ACCOUNT_SELECT} WHERE u.id=?", (account_id,)).fetchone()
    return admin_account_response(row)


@app.post("/v1/admin/accounts/{account_id}/reset-password")
def admin_reset_password(account_id: int, body: AdminPasswordResetBody, request: Request, user=Depends(require_admin)):
    password = validate_temporary_password(body.temporaryPassword)
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id=?", (account_id,)).fetchone()
        if not target: raise HTTPException(404, "account not found")
        if target["role"] == "admin" and not user["is_super_admin"]: raise HTTPException(403, "only a super administrator can reset an administrator password")
        conn.execute("UPDATE users SET password_hash=?,must_change_password=1,updated_at=? WHERE id=?", (password_hash(password), utc_now(), account_id))
        conn.execute("DELETE FROM sessions WHERE user_id=?", (account_id,))
        audit(conn, user["id"], "reset_password", "user", account_id, target["account"], ip_address=request.client.host if request.client else None)
    return {"account": target["account"], "temporaryPassword": password, "mustChangePassword": True}


@app.post("/v1/admin/accounts/{account_id}/revoke-sessions")
def admin_revoke_sessions(account_id: int, request: Request, user=Depends(require_admin)):
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE id=?", (account_id,)).fetchone()
        if not target: raise HTTPException(404, "account not found")
        if target["role"] == "admin" and not user["is_super_admin"]: raise HTTPException(403, "only a super administrator can revoke administrator sessions")
        count = conn.execute("SELECT COUNT(*) FROM sessions WHERE user_id=?", (account_id,)).fetchone()[0]
        conn.execute("DELETE FROM sessions WHERE user_id=?", (account_id,))
        audit(conn, user["id"], "revoke_sessions", "user", account_id, f"account={target['account']};sessions={count}", ip_address=request.client.host if request.client else None)
    return {"account": target["account"], "revokedSessions": count}


@app.get("/v1/admin/anomalies")
def admin_anomalies(user=Depends(require_admin)):
    with db() as conn:
        rows = conn.execute("""
        SELECT p.id,p.title,p.status,p.updated_at,u.account,u.display_name,
          CASE
            WHEN EXISTS(SELECT 1 FROM assets a WHERE a.package_id=p.id AND a.upload_status NOT IN ('completed','uploaded')) THEN 'UPLOAD_FAILED'
            WHEN p.status='PENDING_EDIT' AND p.submitted_at < datetime('now','-24 hours') THEN 'LONG_PENDING_EDIT'
            WHEN p.status='REVISION_REQUESTED' THEN 'REVISION_REQUESTED'
            WHEN p.status='PENDING_REVIEW' THEN 'PENDING_REVIEW'
          END anomaly
        FROM material_packages p JOIN users u ON u.id=p.driver_id
        WHERE p.deleted_at IS NULL AND (
          EXISTS(SELECT 1 FROM assets a WHERE a.package_id=p.id AND a.upload_status NOT IN ('completed','uploaded'))
          OR (p.status='PENDING_EDIT' AND p.submitted_at < datetime('now','-24 hours'))
          OR p.status IN ('REVISION_REQUESTED','PENDING_REVIEW'))
        ORDER BY p.updated_at
        """).fetchall()
        unowned = conn.execute("SELECT COUNT(*) FROM assets WHERE package_id IS NULL AND deleted_at IS NULL").fetchone()[0]
    return {"items": [dict(row) for row in rows], "unownedAssets": unowned}


@app.get("/v1/admin/storage")
def admin_storage(user=Depends(require_admin)):
    disk = shutil.disk_usage(DATA_DIR)
    with db() as conn:
        rows = conn.execute("SELECT u.account,u.display_name,COALESCE(SUM(a.size_bytes),0) size_bytes FROM users u LEFT JOIN assets a ON a.driver_id=u.id AND a.deleted_at IS NULL WHERE u.role='driver' GROUP BY u.id ORDER BY size_bytes DESC").fetchall()
        large = conn.execute("SELECT a.id,a.original_name,a.size_bytes,a.uploaded_at,u.account FROM assets a JOIN users u ON u.id=a.driver_id WHERE a.deleted_at IS NULL ORDER BY a.size_bytes DESC LIMIT 20").fetchall()
        backup = conn.execute("SELECT started_at,finished_at,status,location,size_bytes,detail FROM backup_runs ORDER BY started_at DESC LIMIT 1").fetchone()
    percent = round(disk.used * 100 / disk.total, 1) if disk.total else 0
    level = "critical" if percent >= 95 else "danger" if percent >= 85 else "warning" if percent >= 70 else "normal"
    return {"totalBytes": disk.total, "usedBytes": disk.used, "freeBytes": disk.free, "usedPercent": percent, "thresholdLevel": level, "byAccount": [dict(row) for row in rows], "largeFiles": [dict(row) for row in large], "latestBackup": dict(backup) if backup else None}


@app.get("/v1/drivers")
def list_drivers(query: str | None = None, user=Depends(require_editor)):
    where, params = "WHERE u.role='driver'", []
    if query: where += " AND (u.account LIKE ? OR u.display_name LIKE ?)"; params.extend([f"%{query}%"]*2)
    with db() as conn:
        rows = conn.execute(f"SELECT u.account,u.display_name,u.active,(SELECT COUNT(*) FROM material_packages p WHERE p.driver_id=u.id) package_count,(SELECT COUNT(*) FROM assets a WHERE a.driver_id=u.id) asset_count,(SELECT COALESCE(SUM(a.size_bytes),0) FROM assets a WHERE a.driver_id=u.id) size_bytes,(SELECT MAX(a.uploaded_at) FROM assets a WHERE a.driver_id=u.id) last_activity FROM users u {where} ORDER BY u.account", params).fetchall()
    return {"items":[dict(row) for row in rows]}


@app.get("/v1/audit-logs")
def list_audit_logs(action: str | None = None, result: str | None = None, query: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), user=Depends(require_admin)):
    clauses, params = ["1=1"], []
    if action: clauses.append("l.action=?"); params.append(action)
    if result: clauses.append("l.result=?"); params.append(result)
    if query: clauses.append("(u.account LIKE ? OR u.display_name LIKE ? OR l.detail LIKE ?)"); params.extend([f"%{query}%"]*3)
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM audit_logs l JOIN users u ON u.id=l.actor_id WHERE {' AND '.join(clauses)}",params).fetchone()[0]
        rows = conn.execute(f"SELECT l.id,l.action,l.object_type,l.object_id,l.detail,l.created_at,u.account,u.display_name actor FROM audit_logs l JOIN users u ON u.id=l.actor_id WHERE {' AND '.join(clauses)} ORDER BY l.created_at DESC LIMIT ? OFFSET ?",[*params,page_size,(page-1)*page_size]).fetchall()
    return {"items":[dict(row) for row in rows],"page":page,"pageSize":page_size,"total":total}


@app.get("/v1/revisions")
def list_revisions(status: str | None = None, user=Depends(require_editor)):
    where, params = "", []
    if status: where=" WHERE r.status=?"; params.append(status)
    with db() as conn:
        rows = conn.execute(f"{REVISION_SELECT}{where} ORDER BY r.created_at DESC",params).fetchall()
    return {"items": [revision_response(row) for row in rows]}


@app.get("/v1/me/revisions")
def my_revisions(user=Depends(current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "driver access required")
    with db() as conn:
        rows = conn.execute(f"{REVISION_SELECT} WHERE r.driver_id=? ORDER BY r.created_at DESC", (user["id"],)).fetchall()
    return {"items": [revision_response(row) for row in rows]}


@app.post("/v1/revisions/{revision_id}/reply")
def reply_revision(revision_id: int, body: MessageBody, user=Depends(require_editor)):
    reply = body.message.strip()
    if not reply:
        raise HTTPException(400, "message is required")
    with db() as conn:
        existing = conn.execute("SELECT * FROM revisions WHERE id=?", (revision_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "revision not found")
        replied_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE revisions SET reply=?,replied_by=?,replied_at=?,status='replied' WHERE id=?",
            (reply, user["id"], replied_at, revision_id),
        )
        row = conn.execute(f"{REVISION_SELECT} WHERE r.id=?", (revision_id,)).fetchone()
    return revision_response(row)
