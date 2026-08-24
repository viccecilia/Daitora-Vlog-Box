# Daitora Vlog Box 网页端

剪辑师与管理员使用的静态网页端。浏览器直接调用
`https://api-vlog.daitora-jp.com/v1`，构建结果可以上传到普通静态服务器。

## Prerequisites

- Node.js `>=22.13.0`

## 本地运行

```bash
npm install
npm run dev
npm run build
```

默认 API 地址可以通过 `VITE_API_BASE_URL` 覆盖。生产构建文件位于 `dist/`。

## 当前真实功能

- 账号密码登录并按服务端角色进入工作台
- 按上传用户读取多个独立素材包
- 按上传用户搜索、按视频/图片筛选、按时间/类型排序
- 素材上传、预览和下载

成品夹、用户管理、统计和操作记录仍在后续接入中，页面中的对应区域暂不视为生产功能。
