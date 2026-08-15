# Daitora Vlog Box 微信小程序

用微信开发者工具导入本目录即可运行演示版。`project.config.json` 当前使用测试 AppID。

正式接入前需要：

1. 将 `project.config.json` 的 `appid` 替换为大寅集团的小程序 AppID。
2. 将 `app.js` 的 `apiBase` 替换为正式 HTTPS API 地址，并在微信公众平台加入合法域名。
3. 登录接口以 `wx.login` 的 code 换取会话，司机首次通过管理员邀请码绑定账号。
4. 大视频正式上传建议由 API 返回对象存储临时凭证或分片上传会话。
5. 将 `/assets/video-cover.png` 替换为后端返回的实际成品封面地址。

## 演示账号

- 司机：`D023` / `123456`
- 剪辑师：`editor` / `Daitora1028`

登录通过 `https://api-vlog.daitora-jp.com/v1/auth/login` 完成，系统根据账号角色自动进入对应工作台，不需要用户手动选择司机端或剪辑师端。正式运营前必须在后台修改所有初始密码。
