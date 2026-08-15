# Daitora Vlog Box 双端接口约定（V1）

网页端与微信小程序共用一套业务数据，文件本体进入对象存储，业务信息进入数据库。

## 角色

- `admin`：司机账号管理、操作记录、存储统计。
- `editor`：查看全部素材、跨司机搜索、上传成品、处理修改要求。
- `driver`：上传自己的素材、查看一个最新成品、提交修改或确认、下载到手机。

## 核心对象

- `drivers`：司机编号、姓名、手机号、微信 openid、状态。
- `assets`：文件名、所属司机、类型、大小、上传时间、存储键、抽帧图、状态。
- `driver_asset_packages`：每位司机固定一个素材包；后续上传只向该包追加，不按日期重复建包。
- `finished_products`：目标司机、版本号、视频地址、封面、时长、上传时间、状态。
- `revisions`：成品、司机、文字要求、时间点、截图附件、处理状态。
- `audit_logs`：操作者、动作、对象、IP、时间。

## V1 接口

- `POST /auth/login`：网页与小程序统一账号密码登录，返回用户、角色和会话；客户端按 `driver`、`editor` 或 `admin` 自动进入相应工作台。
- `POST /auth/wechat/bind`：可选功能；登录后用小程序 `wx.login` code 绑定微信，后续可免输密码。
- `GET /drivers?query=`：按姓名或司机编号搜索。
- `GET /assets?driverId=&type=&query=&cursor=`：统一素材夹列表。
- `GET /driver-asset-packages?driverId=&sort=time|type`：按司机返回素材包；包内素材可按上传时间或文件类型排序。
- `POST /assets/upload-session`：申请分片或直传地址。
- `POST /assets/complete`：登记文件并触发视频抽帧。
- `GET /finished-products?driverId=&query=`：成品夹列表。
- `POST /finished-products`：剪辑师上传新版本。
- `GET /me/latest-finished-product`：司机只读取自己的最新成品。
- `POST /finished-products/:id/revisions`：提交修改要求。
- `POST /finished-products/:id/confirm`：司机确认成品。
- `GET /downloads/:id`：生成短时有效下载地址。

所有时间由服务端保存 UTC，界面统一显示为 `MM-DD HH:mm`。下载地址建议 10 分钟失效；上传完成后异步生成视频抽帧和成品封面。

## 上线前环境变量

- `API_BASE_URL`
- `DATABASE_URL`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ENDPOINT`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`（仅服务端）
- `SESSION_SECRET`（仅服务端）

演示账号只存在于前端原型，正式环境必须删除，密码哈希存储并通过服务端鉴权。
