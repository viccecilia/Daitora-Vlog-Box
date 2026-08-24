# Daitora Vlog Box

企业素材库双端项目。Web 与微信小程序共用同一套 API、SQLite 业务数据和原始文件存储。

## 目录

- `backend/`：FastAPI、SQLite、幂等迁移、原始素材和成品文件服务。
- `web/`：管理员与剪辑师使用的桌面优先管理端。
- `miniapp/`：上传用户与移动剪辑师共用的微信小程序。
- `shared/`：双端共用的数据模型和接口约定。

## 网页版

进入 `web` 后运行：

```bash
npm install
npm run dev
```

构建与验证：`npm run lint`、`npm test`。API 地址由 `VITE_API_BASE_URL` 提供。

## 微信小程序

使用微信开发者工具导入 `miniapp` 目录。AppID 放在本机私有配置中；正式域名必须加入微信公众平台 request/uploadFile/downloadFile 合法域名。

## 后端与迁移

进入 `backend` 安装 `requirements.txt` 后运行 `uvicorn app:app`。首次启动自动执行 `migrations/` 中的幂等迁移。口令只通过 `BOOTSTRAP_ADMIN_PASSWORD`、`BOOTSTRAP_EDITOR_PASSWORD`、`BOOTSTRAP_UPLOADER_PASSWORD` 环境变量设置。

升级前停止写入并备份 SQLite 数据库、`uploads`、`finished-products` 和 `asset-memos`。部署顺序为：备份与完整性检查 → 安装依赖 → 启动新版本 → `/health` → 角色端到端验收 → 切换流量。回滚时停止新版本、恢复应用版本及整套数据库/媒体备份，不做 SQLite 局部删列。

原始视频按字节保存，不压缩、不转码。整包下载使用磁盘临时 ZIP，完成响应后自动删除临时文件；生产环境仍需监控磁盘余量和反向代理超时。
