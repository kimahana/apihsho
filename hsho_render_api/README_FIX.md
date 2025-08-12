# apihsho ESM Hotfix (for Render)

把这个压缩包解压到你的仓库根目录 `hsho_render_api/`，覆盖同名文件：
- `index.js`（ESM 版本，修复 "require is not defined"）
- `src/routes/ygg_core.js`、`src/routes/ygg_generic.js`（完整 YGG 路由）
- `db/schema.sql`、`db/seed.sql`（数据库结构与种子数据）

Render 环境变量：
- `DATABASE_URL`（Postgres 连接串）
- `NODE_ENV=production`
- `PORT=10000`

部署后执行（Render Shell）：
```
psql $DATABASE_URL -f db/schema.sql
psql $DATABASE_URL -f db/seed.sql
```

测试：
- `/health`
- `/YGG/GetPlayerAPI?playerId=demo-player-001`
- `/YGG/GetStoreAPI`
- `/YGG/GetLootboxAPI?playerId=demo-player-001`
- `/YGG/GetRankedAPI?playerId=demo-player-001`
