
# HSHO API Mock (Always Success)

一个适配 **Home Sweet Home: Online** 的简易 Mock API：
- 任何以 `/live/` 开头的请求，返回 `{ "error": 0, "success": true }`
- 自带日志 `logs/requests.log`
- 可直接部署到 **Render (Free)** 或本地运行

## 本地运行

```bash
npm install
npm start
# 默认端口 10000
# 访问 http://localhost:10000/live/ping
```

## 常用接口（都返回 success）
- `GET /live/health`
- `GET /live/ping`
- `POST /live/player/login`
- `GET /live/store/products`
- 以及任何 `/live/*` 路径（通配）

## Render 部署步骤（免费）
1. 创建一个新的 **Web Service**
2. 选择你的 GitHub 仓库（上传本项目代码）
3. **Build Command**：`npm install`
4. **Start Command**：`npm start`
5. **Environment**：`Node`，区域随意
6. 部署完成后得到一个域名，例如：`https://your-app.onrender.com`

## 游戏端改域名
把 `YGGGameServiceFunctionLibrary` 里所有 HTTP 域名替换为你的 Render 域名：
- 例：`https://your-app.onrender.com`  
确保所有路径都以 `/live/...` 开头。Mock 会自动成功。

## 测试
```bash
curl https://your-app.onrender.com/live/ping
# {"error":0,"success":true,"pong":true}
```
