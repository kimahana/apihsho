# YGG Full API (Render-ready)

**目标**：提供与原游戏一致的 `/YGG/...` 接口集合，
- 优先使用你提供的 `live` JSON 数据
- 缺失的接口用占位数据 `{ ok: true, data: [] }`
- 关键接口（玩家、商店、扭蛋、排位、邮箱等）提供结构化且非空的返回
- 所有数据保存在 PostgreSQL，支持 Render 免费数据库

## 跑起来（本地）
1. 安装 Node 18+ 和 PostgreSQL
2. `.env`：
   ```
   DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME
   PORT=10000
   NODE_ENV=development
   ```
3. 初始化：
   ```
   psql $DATABASE_URL -f db/schema.sql
   psql $DATABASE_URL -f db/seed.sql
   ```
4. 启动：
   ```
   npm i
   npm start
   ```

## 核心路由（结构化）
- `GET /YGG/GetPlayerAPI?playerId=xxx`
- `GET /YGG/GetStoreAPI`
- `GET /YGG/GetLootboxAPI?playerId=xxx`
- `GET /YGG/GetRankedAPI?playerId=xxx`
- `GET /YGG/GetQuestSkinAPI`（可空）
- `GET /YGG/GetCurseRelicAPI`（可空）
- `GET /YGG/Announcement`（可空）
- `GET /YGG/GetServerVersion`（可空）
- `GET /YGG/MailBoxGet`（可空）
- `POST /YGG/MailBoxRead|MailBoxClaim|MailBoxRemove`（回 `{ ok: true }`）
- `POST /YGG/LogReport|LogTransaction|LogStore|LogGetPlayerData`（写入 logs）

## 通用路由（自动覆盖所有其余 /YGG/:name）
- `GET /YGG/:name`：从 `ygg_api_cache` 读取 payload，如果没有，就返回 `{ ok: true, data: [] }`
- `POST /YGG/:name`：写入 logs；若 body 里带有 `payload` 字段，会写入/更新 `ygg_api_cache`

> 种子数据会把你 `live` 目录下的所有 JSON 导入到 `ygg_api_cache`，key = 文件名（去掉 `.json`）。
> 同时也会把 `YGGGameServiceFunctionLibrary.json` 解析出的函数名补齐为 `{ ok: true, data: [] }`。

## Render 部署
- Build Command：`npm i`
- Start Command：`npm start`
- 环境变量：`DATABASE_URL`、`NODE_ENV=production`、`PORT=10000`
- 部署后执行：
  ```
  psql $DATABASE_URL -f db/schema.sql
  psql $DATABASE_URL -f db/seed.sql
  ```
- 健康检查：`GET /health`

## 维护数据
- 想更新某个 `/YGG/SomeAPI` 的返回：
  - 方法一：直接 `POST /YGG/SomeAPI`，body：`{ "payload": { ... } }`
  - 方法二：更新数据库表 `ygg_api_cache` 中 `name='SomeAPI'` 的 `payload` 字段
