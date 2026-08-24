import argparse
import hashlib
import io
import json
import mimetypes
import os
import zipfile
from pathlib import Path

import requests


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest_file(path: Path) -> str:
    return digest_bytes(path.read_bytes())


def require(response: requests.Response, expected: int | tuple[int, ...] = 200):
    expected_codes = (expected,) if isinstance(expected, int) else expected
    if response.status_code not in expected_codes:
        raise RuntimeError(f"{response.request.method} {response.url}: {response.status_code} {response.text[:500]}")
    if response.headers.get("content-type", "").startswith("application/json"):
        return response.json()
    return response.content


parser = argparse.ArgumentParser()
parser.add_argument("files", nargs=3, type=Path)
parser.add_argument("--base", default="https://api-vlog.daitora-jp.com")
args = parser.parse_args()
uploader_account = os.environ["DAITORA_TEST_UPLOADER"]
uploader_password = os.environ["DAITORA_TEST_UPLOADER_PASSWORD"]
editor_account = os.environ["DAITORA_TEST_EDITOR"]
editor_password = os.environ["DAITORA_TEST_EDITOR_PASSWORD"]


def token(account: str, password: str) -> str:
    response = requests.post(f"{args.base}/v1/auth/login", json={"account": account, "password": password}, timeout=30)
    return require(response)["token"]


uploader = {"Authorization": f"Bearer {token(uploader_account, uploader_password)}"}
editor = {"Authorization": f"Bearer {token(editor_account, editor_password)}"}
package = require(requests.post(f"{args.base}/v1/material-packages", headers=uploader, json={
    "shootDate": "2026-08-21", "theme": "其他", "title": "生产闭环验收-20260821"
}, timeout=30))
package_id = package["id"]
assets = []
for index, path in enumerate(args.files, 1):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    with path.open("rb") as stream:
        result = require(requests.post(
            f"{args.base}/v1/assets/upload",
            headers=uploader,
            data={"package_id": str(package_id), "memo_text": f"验收素材 {index}：保留原始文件"},
            files={"file": (path.name, stream, mime)},
            timeout=300,
        ))
    assets.append((result, path))

preview_types = []
hash_matches = []
for asset, path in assets:
    preview = requests.get(f"{args.base}/v1/assets/{asset['id']}/preview", headers=uploader, timeout=120)
    require(preview)
    preview_types.append(preview.headers.get("content-type"))
    downloaded = require(requests.get(f"{args.base}/v1/assets/{asset['id']}/download", headers=editor, timeout=120))
    hash_matches.append(digest_bytes(downloaded) == digest_file(path))

require(requests.post(f"{args.base}/v1/material-packages/{package_id}/submit", headers=uploader, timeout=30))
editor_list = require(requests.get(f"{args.base}/v1/material-packages", headers=editor, params={"driver_id": uploader_account, "query": "生产闭环验收"}, timeout=30))
assert any(item["id"] == package_id for item in editor_list["items"])
require(requests.post(f"{args.base}/v1/material-packages/{package_id}/start-editing", headers=editor, timeout=30))

archive = require(requests.get(f"{args.base}/v1/material-packages/{package_id}/download", headers=editor, timeout=300))
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    zip_hashes = {name: digest_bytes(bundle.read(name)) for name in bundle.namelist()}
zip_matches = all(digest_file(path) in zip_hashes.values() for _, path in assets)

product_source = args.files[2]
with product_source.open("rb") as stream:
    product_v1 = require(requests.post(
        f"{args.base}/v1/finished-products/upload", headers=editor,
        data={"package_id": str(package_id), "title": "验收成品", "version_note": "V1"},
        files={"file": ("acceptance-v1.mp4", stream, "video/mp4")}, timeout=300,
    ))
assert product_v1["ownerAccount"] == uploader_account and product_v1["packageId"] == package_id
latest = require(requests.get(f"{args.base}/v1/me/latest-finished-product", headers=uploader, timeout=30))["item"]
assert latest["id"] == product_v1["id"] and latest["driverCode"] == uploader_account
product_download = require(requests.get(f"{args.base}/v1/finished-products/{latest['id']}/download", headers=uploader, timeout=300))
product_hash_match = digest_bytes(product_download) == digest_file(product_source)

revision = require(requests.post(
    f"{args.base}/v1/finished-products/{latest['id']}/revision-items", headers=uploader,
    json={"items": [{"timecode": "00:03", "message": "请在此处调整字幕节奏"}]}, timeout=30,
))
revision_id = revision["ids"][0]
require(requests.post(f"{args.base}/v1/revisions/{revision_id}/reply", headers=editor, json={"message": "已收到并完成调整"}, timeout=30))
require(requests.post(f"{args.base}/v1/material-packages/{package_id}/start-revision", headers=editor, timeout=30))
with product_source.open("rb") as stream:
    product_v2 = require(requests.post(
        f"{args.base}/v1/finished-products/upload", headers=editor,
        data={"package_id": str(package_id), "title": "验收成品", "version_note": "V2 修改完成"},
        files={"file": ("acceptance-v2.mp4", stream, "video/mp4")}, timeout=300,
    ))
assert product_v2["ownerAccount"] == uploader_account and product_v2["versionNumber"] == 2
require(requests.post(f"{args.base}/v1/material-packages/{package_id}/confirm", headers=uploader, timeout=30))
forbidden = requests.get(f"{args.base}/v1/finished-products", headers=uploader, timeout=30).status_code
detail = require(requests.get(f"{args.base}/v1/material-packages/{package_id}", headers=uploader, timeout=30))

print(json.dumps({
    "package_id": package_id,
    "asset_ids": [asset["id"] for asset, _ in assets],
    "asset_hash_matches": hash_matches,
    "zip_hash_match": zip_matches,
    "preview_content_types": preview_types,
    "product_ids": [product_v1["id"], product_v2["id"]],
    "product_hash_match": product_hash_match,
    "owner_account": product_v2["ownerAccount"],
    "revision_id": revision_id,
    "final_status": detail["status"],
    "uploader_global_products_status": forbidden,
}, ensure_ascii=False, indent=2))
