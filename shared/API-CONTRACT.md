# Daitora Vlog Box 双端接口约定（V1）

网页端与微信小程序共用一套业务数据，文件本体进入对象存储，业务信息进入数据库。

## 角色

- `admin`：素材账号管理、操作记录、存储统计。
- `editor`：查看全部素材、跨用户搜索、上传成品、处理修改要求。
- `driver`：内部角色代码；界面统一称“上传用户”，只能管理自己的素材包、成品和反馈。

## 核心对象

- `users`：素材账号、姓名、微信 openid、状态。
- `assets`：文件名、所属上传用户、类型、大小、上传时间、存储键、抽帧图、状态。
- `material_packages`：上传用户按拍摄任务建立的独立素材包。
- `finished_products`：所属素材包、服务端推导的接收账号、版本号、视频地址、封面、时长、上传时间、状态。
- `revisions`：成品、用户、文字要求、时间点、截图附件、处理状态。
- `audit_logs`：操作者、动作、对象、IP、时间。

## V1 接口

- `POST /auth/login`：网页与小程序统一账号密码登录，返回用户、角色和会话；客户端按 `driver`、`editor` 或 `admin` 自动进入相应工作台。
- `POST /auth/wechat/bind`：可选功能；登录后用小程序 `wx.login` code 绑定微信，后续可免输密码。
- `GET /drivers?query=`：按姓名或素材账号搜索。
- `GET /assets?package_id=&driver_id=&media_type=&orientation=&query=&sort=&page=`：素材文件分页与组合筛选。
- 素材库并列视图：文件夹模式按“上传用户 → 有效日期倒序素材包 → 文件”，全部文件模式按上传用户跨素材包汇总。
- 有效日期优先 `shoot_date`，缺失时回退文件 `uploaded_at`；响应返回 `effective_date/date_source`，客户端必须显示“拍摄日期”或“上传日期”。
- `GET /assets` 还支持 `date_from/date_to/theme/location/tag/status`，筛选、排序和分页均在服务端执行。
- `GET /library/stats?driver_id=` 分别返回上传用户数、素材包数和文件数，不混用统计口径。
- `GET /material-packages?driver_id=&status=&theme=&location=&usage=&tag=&sort=&page=`：素材包分页、组合筛选和排序。
- `POST /material-packages/:id/metadata`：草稿分类信息更新。
- `GET /material-packages/:id/download`：以 ZIP_STORED 磁盘临时包下载原文件。
- `GET /assets/:id/preview|download`：授权预览或下载单文件。
- `POST /assets/batch-classify`：剪辑师批量更新素材包标签和用途。
- `POST /assets/upload-session`：申请分片或直传地址。
- `POST /assets/complete`：登记文件并触发视频抽帧。
- `GET /finished-products?driverId=&query=`：成品夹列表。
- `POST /finished-products/upload`：剪辑师以 `package_id` 上传新版本；服务端从素材包推导并锁定接收账号，忽略客户端任何归属字段。
- `GET /me/latest-finished-product`：上传用户只读取自己的最新成品。
- `POST /finished-products/:id/revisions`：提交修改要求。
- `POST /finished-products/:id/confirm`：上传用户确认成品。
- `GET /audit-logs`、`GET /revisions`、`GET /drivers`：真实审计、反馈与素材账号数据。

普通上传用户只能读取和下载本人素材包关联的成品；剪辑师与管理员可读取全部。成品上传、下载、确认和修改均写入 `audit_logs`。

## 管理接口与敏感操作

- `GET /v1/admin/overview`：返回真实账号、素材包、素材文件、成品及异常任务数量。
- `GET|POST /v1/admin/accounts`：搜索和新增账号；管理员可新增上传用户/剪辑师，只有超级管理员可新增管理员。
- `PATCH /v1/admin/accounts/:id`：修改显示名、角色或启停状态；停用会撤销会话，不能停用最后一个可用管理员或超级管理员。
- `POST /v1/admin/accounts/:id/reset-password`：设置一次性临时密码并强制首次改密，接口不返回哈希或原密码。
- `POST /v1/admin/accounts/:id/revoke-sessions`：强制退出指定账号。
- `GET /v1/admin/anomalies`、`GET /v1/admin/storage`：返回真实异常与磁盘数据；没有备份记录时 `latestBackup` 为 `null`，不得伪造成功。
- `GET /v1/audit-logs`：仅管理员可读，支持动作、结果和关键字筛选。

后端逐接口验证角色；前端隐藏按钮不构成权限控制。管理员授权、永久删除和归属纠正预留给超级管理员，并要求二次确认、原因和完整审计。

所有时间由服务端保存 UTC，界面统一显示为 `MM-DD HH:mm`。下载地址建议 10 分钟失效；上传完成后异步生成视频抽帧和成品封面。

## 上线前环境变量

- `API_BASE_URL`
- `DATABASE_URL`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ENDPOINT`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`（仅服务端）
- `SESSION_SECRET`（仅服务端）

初始账号只通过部署环境配置，密码哈希存储并通过服务端鉴权。
