import os
import secrets
import tempfile
import unittest

from fastapi.testclient import TestClient


class WorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        os.environ["DAITORA_DATA_DIR"] = cls.temp.name
        cls.editor_password = secrets.token_urlsafe(24)
        cls.uploader_password = secrets.token_urlsafe(24)
        cls.admin_password = secrets.token_urlsafe(24)
        os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = cls.admin_password
        os.environ["BOOTSTRAP_EDITOR_PASSWORD"] = cls.editor_password
        os.environ["BOOTSTRAP_UPLOADER_PASSWORD"] = cls.uploader_password
        import app
        cls.client = TestClient(app.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def login(self, account, password):
        response = self.client.post("/v1/auth/login", json={"account": account, "password": password})
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['token']}"}

    def test_complete_revision_workflow_and_permissions(self):
        driver = self.login("admin01", self.uploader_password)
        other = self.login("admin02", self.uploader_password)
        editor = self.login("admin00", self.editor_password)
        administrator = self.login("admin", self.admin_password)
        created = self.client.post("/v1/material-packages", headers=driver, json={"shootDate":"2026-08-18","theme":"工作日常","title":"工作记录","location":"大阪","tags":["接送"],"usage":"短视频"})
        self.assertEqual(created.status_code, 200, created.text)
        package_id = created.json()["id"]
        self.assertEqual(self.client.get(f"/v1/material-packages/{package_id}", headers=other).status_code, 403)
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/submit", headers=driver).status_code, 409)
        uploaded = self.client.post("/v1/assets/upload", headers=driver, data={"package_id":str(package_id),"memo_text":"机场到达口的接客画面"}, files={"file":("clip.mp4",b"video","video/mp4")})
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        asset_id = uploaded.json()["id"]
        package = self.client.get(f"/v1/material-packages/{package_id}", headers=driver).json()
        self.assertEqual(package["fileCount"], 1)
        self.assertEqual(package["videoCount"], 1)
        self.assertEqual(package["imageCount"], 0)
        self.assertEqual(package["sizeBytes"], 5)
        self.assertEqual(package["location"], "大阪")
        self.assertEqual(package["tags"], ["接送"])
        assets = self.client.get(f"/v1/assets?package_id={package_id}&media_type=video", headers=editor)
        self.assertEqual(assets.status_code, 403)
        voice = self.client.post(f"/v1/assets/{asset_id}/voice-memo", headers=driver, files={"file":("memo.mp3",b"voice","audio/mpeg")})
        self.assertEqual(voice.status_code, 200, voice.text)
        self.assertEqual(self.client.get(f"/v1/assets/{asset_id}/voice-memo", headers=other).status_code, 403)
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/submit", headers=driver).json()["status"], "PENDING_EDIT")
        supplement = self.client.post("/v1/assets/upload", headers=driver, data={"package_id":str(package_id)}, files={"file":("extra.jpg",b"image","image/jpeg")})
        self.assertEqual(supplement.status_code, 200, supplement.text)
        assets = self.client.get(f"/v1/assets?package_id={package_id}&media_type=video", headers=editor).json()
        self.assertEqual(assets["total"], 1)
        archive = self.client.get(f"/v1/material-packages/{package_id}/download", headers=editor)
        self.assertEqual(archive.status_code, 200, archive.text)
        self.assertEqual(archive.headers["content-type"], "application/zip")
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/start-editing", headers=driver).status_code, 403)
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/start-editing", headers=editor).json()["status"], "EDITING")
        v1 = self.client.post("/v1/finished-products/upload", headers=editor, data={"driver_code":"admin02","package_id":str(package_id),"title":"测试成品"}, files={"file":("v1.mp4",b"v1","video/mp4")})
        self.assertEqual(v1.status_code, 200, v1.text); self.assertEqual(v1.json()["versionNumber"], 1)
        self.assertEqual(v1.json()["ownerAccount"],"admin01")
        product_id = v1.json()["id"]
        self.assertEqual(self.client.get(f"/v1/finished-products/{product_id}/download",headers=other).status_code,403)
        self.assertEqual(self.client.get(f"/v1/finished-products/{product_id}/download",headers=driver).status_code,200)
        products = self.client.get("/v1/finished-products?query=测试",headers=editor).json()
        self.assertEqual(products["total"],1)
        revision = self.client.post(f"/v1/finished-products/{product_id}/revision-items", headers=driver, json={"items":[{"timecode":"00:18","message":"加快节奏"},{"timecode":"00:30","message":"延长Logo"}]})
        self.assertEqual(revision.status_code, 200, revision.text)
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/start-revision", headers=editor).json()["status"], "REVISING")
        v2 = self.client.post("/v1/finished-products/upload", headers=editor, data={"package_id":str(package_id),"title":"测试成品"}, files={"file":("v2.mp4",b"v2","video/mp4")})
        self.assertEqual(v2.json()["versionNumber"], 2)
        detail = self.client.get(f"/v1/material-packages/{package_id}", headers=driver).json()
        self.assertEqual(len(detail["products"]), 2)
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/confirm", headers=driver).json()["status"], "COMPLETED")
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/archive",headers=driver).status_code,403)
        self.assertEqual(self.client.post(f"/v1/material-packages/{package_id}/archive",headers=editor).json()["status"],"ARCHIVED")
        logs=self.client.get("/v1/audit-logs?page_size=200",headers=administrator).json()["items"]
        actions={(item["action"],item["object_type"]) for item in logs}
        self.assertIn(("upload","finished_product"),actions)
        self.assertIn(("download","finished_product"),actions)
        self.assertIn(("create","revision_batch"),actions)
        self.assertIn(("confirm","material_package"),actions)

    def test_admin_account_permissions_and_last_admin_protection(self):
        uploader = self.login("admin01", self.uploader_password)
        editor = self.login("admin00", self.editor_password)
        super_admin = self.login("admin", self.admin_password)
        self.assertEqual(self.client.get("/v1/admin/accounts", headers=uploader).status_code, 403)
        self.assertEqual(self.client.get("/v1/admin/accounts", headers=editor).status_code, 403)
        accounts = self.client.get("/v1/admin/accounts", headers=super_admin)
        self.assertEqual(accounts.status_code, 200, accounts.text)
        root = next(item for item in accounts.json()["items"] if item["account"] == "admin")
        self.assertTrue(root["isSuperAdmin"])
        protected = self.client.patch(f"/v1/admin/accounts/{root['id']}", headers=super_admin, json={"active": False})
        self.assertEqual(protected.status_code, 409, protected.text)
        created_admin = self.client.post("/v1/admin/accounts", headers=super_admin, json={"account":"ops-admin","displayName":"运营管理员","role":"ADMIN"})
        self.assertEqual(created_admin.status_code, 200, created_admin.text)
        self.assertNotIn("password_hash", created_admin.text)
        normal_admin = self.login("ops-admin", created_admin.json()["temporaryPassword"])
        denied_grant = self.client.post("/v1/admin/accounts", headers=normal_admin, json={"account":"forbidden-admin","displayName":"禁止授权","role":"ADMIN"})
        self.assertEqual(denied_grant.status_code, 403, denied_grant.text)
        denied_editor = self.client.post("/v1/admin/accounts", headers=editor, json={"account":"editor-created","displayName":"越权创建","role":"UPLOADER"})
        self.assertEqual(denied_editor.status_code, 403, denied_editor.text)
        created_user = self.client.post("/v1/admin/accounts", headers=normal_admin, json={"account":"managed-user","displayName":"受管账号","role":"UPLOADER"})
        self.assertEqual(created_user.status_code, 200, created_user.text)
        managed = created_user.json()["account"]
        disabled = self.client.patch(f"/v1/admin/accounts/{managed['id']}", headers=normal_admin, json={"active": False})
        self.assertEqual(disabled.status_code, 200, disabled.text)
        failed_login = self.client.post("/v1/auth/login", json={"account":"managed-user","password":created_user.json()["temporaryPassword"]})
        self.assertEqual(failed_login.status_code, 401, failed_login.text)
        self.assertEqual(self.client.get("/v1/admin/overview", headers=normal_admin).status_code, 200)
        self.assertEqual(self.client.get("/v1/admin/anomalies", headers=normal_admin).status_code, 200)
        storage = self.client.get("/v1/admin/storage", headers=normal_admin)
        self.assertEqual(storage.status_code, 200, storage.text)
        self.assertIsNone(storage.json()["latestBackup"])

    def test_domain_migration_fields_are_present(self):
        import app
        with app.db() as conn:
            package_columns={row[1] for row in conn.execute("PRAGMA table_info(material_packages)")}
            asset_columns={row[1] for row in conn.execute("PRAGMA table_info(assets)")}
            versions={row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
        self.assertTrue({"shoot_date","theme","location","title","tags","usage","status","submitted_at"} <= package_columns)
        self.assertTrue({"duration_seconds","width","height","orientation","thumbnail_key","memo_text","upload_status"} <= asset_columns)
        self.assertIn("20260821_domain_v3",versions)
        self.assertIn("20260821_admin_v4",versions)

    def test_user_level_library_filters_and_date_fallback(self):
        editor=self.login("admin00",self.editor_password)
        first=self.login("admin01",self.uploader_password)
        second=self.login("admin02",self.uploader_password)
        def create(owner,date,title,file_name):
            package=self.client.post("/v1/material-packages",headers=owner,json={"shootDate":date,"theme":"日常素材","title":title}).json()
            asset=self.client.post("/v1/assets/upload",headers=owner,data={"package_id":str(package["id"])},files={"file":(file_name,b"data","video/mp4")}).json()
            self.client.post(f"/v1/material-packages/{package['id']}/submit",headers=owner)
            return package,asset
        p1,a1=create(first,"2026-08-01","第一包","first-one.mp4")
        p2,a2=create(first,"2026-08-02","第二包","first-two.mp4")
        create(second,"2026-08-03","其他用户包","second-user.mp4")
        filtered=self.client.get("/v1/assets?driver_id=admin01&page_size=1",headers=editor).json()
        self.assertGreaterEqual(filtered["total"],2)
        self.assertEqual(len(filtered["items"]),1)
        all_users=self.client.get("/v1/assets?page_size=100",headers=editor).json()
        self.assertGreater(all_users["total"],filtered["total"])
        package_only=self.client.get(f"/v1/assets?package_id={p1['id']}",headers=editor).json()
        self.assertEqual(package_only["total"],1)
        self.assertEqual(package_only["items"][0]["id"],a1["id"])
        date_only=self.client.get("/v1/assets?driver_id=admin01&date_from=2026-08-02&date_to=2026-08-02",headers=editor).json()
        self.assertTrue(any(item["id"]==a2["id"] for item in date_only["items"]))
        with __import__("app").db() as conn:
            conn.execute("UPDATE material_packages SET shoot_date='' WHERE id=?",(p1["id"],))
        fallback=self.client.get(f"/v1/assets?package_id={p1['id']}",headers=editor).json()["items"][0]
        self.assertEqual(fallback["date_source"],"uploaded_at")
        self.assertEqual(fallback["effective_date"],fallback["uploaded_at"][:10])


if __name__ == "__main__":
    unittest.main()
