# Daitora Vlog Box

企业素材库双端项目，按照已确认的 Demo 拆分为两个客户端，共用同一套后端接口和文件存储。

## 目录

- `web/`：管理员与剪辑师使用的网页版，也保留司机端演示入口。
- `miniapp/`：微信小程序，面向司机上传、查看成品、提交修改和手机下载；同时提供移动剪辑入口。
- `shared/`：双端共用的数据模型和接口约定。

## 网页版

进入 `web` 后运行：

```bash
npm install
npm run dev
```

演示账号：`admin`  
演示密码：`Daitora1028`

## 微信小程序

使用微信开发者工具导入 `miniapp` 目录。当前 `project.config.json` 使用测试 AppID；正式使用时替换为企业自己的 AppID，并在 `services/api.js` 配置正式接口域名。

## 正式上线前

需要接入服务端登录、数据库和对象存储。演示密码不得继续放在客户端代码中，微信 AppSecret 只能保存在服务端。
