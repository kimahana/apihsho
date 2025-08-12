import { Router } from 'express';
import { q } from '../index.js';

const router = Router();

// GET /YGG/GetPlayerAPI?playerId=...
router.get('/GetPlayerAPI', async (req, res) => {
  const playerId = req.query.playerId || 'demo-player-001';
  try {
    await q(`INSERT INTO players (player_id, display_name, role, level, exp)
             VALUES ($1, $2, 'Survivor', 1, 0)
             ON CONFLICT (player_id) DO NOTHING`, [playerId, `Player_${playerId.slice(0,6)}`]);

    const player = (await q(`SELECT player_id, display_name, role, level, exp FROM players WHERE player_id=$1`, [playerId])).rows[0];
    await q(`INSERT INTO balances (player_id, coin, gem) VALUES ($1,0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    const bal = (await q(`SELECT coin, gem FROM balances WHERE player_id=$1`, [playerId])).rows[0] || { coin:0, gem:0 };
    await q(`INSERT INTO lootbox_balances (player_id, balance) VALUES ($1,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    const lb = (await q(`SELECT balance FROM lootbox_balances WHERE player_id=$1`, [playerId])).rows[0] || { balance:0 };
    await q(`INSERT INTO ranked_stats (player_id, rank_name, rank_point, mmr) VALUES ($1,'Bronze',0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    const rk = (await q(`SELECT rank_name, rank_point, mmr FROM ranked_stats WHERE player_id=$1`, [playerId])).rows[0] || { rank_name:'Bronze', rank_point:0, mmr:0 };
    const inv = (await q(`SELECT item_type, short_code, quantity FROM inventory_items WHERE player_id=$1 ORDER BY id`, [playerId])).rows;

    res.json({
      player: {
        playerId: player.player_id,
        displayName: player.display_name,
        profile: { level: player.level, exp: player.exp },
        role: player.role
      },
      playerBalance: { coin: bal.coin ?? 0, gem: bal.gem ?? 0 },
      lootBoxBalance: { balance: lb.balance ?? 0, boxes: [] },
      inventory: {
        items: inv.filter(i => i.item_type === 'item'),
        skins: inv.filter(i => i.item_type === 'skin'),
        stickers: inv.filter(i => i.item_type === 'sticker')
      },
      records: { survivor:{}, hunter:{}, mode4v4:{} },
      ranked: { rankName: rk.rank_name, rankPoint: rk.rank_point, mmr: rk.mmr }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /YGG/GetStoreAPI
router.get('/GetStoreAPI', async (req, res) => {
  try {
    const rows = (await q(`SELECT short_code, name, price_base, currency, COALESCE(tags,'{}') AS tags FROM store_products ORDER BY short_code`)).rows;
    const tags = new Set();
    rows.forEach(r => (r.tags||[]).forEach(t => tags.add(t)));
    res.json({
      store: {
        products: rows.map(r => ({
          short_code: r.short_code,
          name: r.name,
          price: { base: r.price_base, currency: r.currency },
          tags: r.tags,
          isNewProduct: false
        })),
        tags: Array.from(tags),
        priceMap: {}
      }
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /YGG/GetLootboxAPI?playerId=...
router.get('/GetLootboxAPI', async (req, res) => {
  const playerId = req.query.playerId || 'demo-player-001';
  try {
    const row = (await q(`SELECT balance FROM lootbox_balances WHERE player_id=$1`, [playerId])).rows[0] || { balance: 0 };
    res.json({ lootbox: { balance: row.balance ?? 0, entries: [] } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /YGG/GetRankedAPI?playerId=...
router.get('/GetRankedAPI', async (req, res) => {
  const playerId = req.query.playerId || 'demo-player-001';
  try {
    const row = (await q(`SELECT rank_name, rank_point, mmr FROM ranked_stats WHERE player_id=$1`, [playerId])).rows[0] || { rank_name:'Bronze', rank_point:0, mmr:0 };
    res.json({ ranked: { rankName: row.rank_name, rankPoint: row.rank_point, mmr: row.mmr, leaderboard: [] } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Mailbox
router.get('/MailBoxGet', async (req, res) => res.json({ mails: [] }));
router.post('/MailBoxRead', async (req, res) => res.json({ ok: true }));
router.post('/MailBoxClaim', async (req, res) => res.json({ ok: true }));
router.post('/MailBoxRemove', async (req, res) => res.json({ ok: true }));

// Quest / Curse
router.get('/GetQuestSkinAPI', async (req, res) => res.json({ questSkin: { goals: [] } }));
router.get('/GetCurseRelicAPI', async (req, res) => res.json({ curseRelic: { relics: [], curses: [] } }));

// Announcement / Version
router.get('/Announcement', async (req, res) => res.json({ announcements: [] }));
router.get('/GetServerVersion', async (req, res) => res.json({ version: '1.0.0', message: '' }));

// Logs
router.post('/LogReport', async (req, res) => {
  await q(`INSERT INTO logs (type, player_id, payload) VALUES ('report', $1, $2)`, [req.body?.playerId || null, req.body || {}]);
  res.json({ ok: true });
});
router.post('/LogTransaction', async (req, res) => {
  await q(`INSERT INTO logs (type, player_id, payload) VALUES ('transaction', $1, $2)`, [req.body?.playerId || null, req.body || {}]);
  res.json({ ok: true });
});
router.post('/LogStore', async (req, res) => {
  await q(`INSERT INTO logs (type, player_id, payload) VALUES ('store', $1, $2)`, [req.body?.playerId || null, req.body || {}]);
  res.json({ ok: true });
});
router.post('/LogGetPlayerData', async (req, res) => {
  await q(`INSERT INTO logs (type, player_id, payload) VALUES ('getplayerdata', $1, $2)`, [req.body?.playerId || null, req.body || {}]);
  res.json({ ok: true });
});

export default router;
