
# HSHO Render API

## 部署方法
1. 解压这个文件夹
2. 打开 https://dashboard.render.com/
3. 注册/登录 Render 账号
4. 点击 "New +" -> "Web Service"
5. 选择 "Deploy from a Git repository" 或 "Manual Deploy" (直接上传文件)
6. 上传本文件夹内容
7. 运行环境选择 Node.js 18+
8. Start Command 填写: node index.js
9. 部署完成后会得到一个类似 https://hsho-api.onrender.com 的域名
10. 把这个域名发给我，我帮你改 YGGGameServiceFunctionLibrary.uasset 让游戏直接连 API
