import { Router } from 'express';
import { q } from '../../index.js';

const router = Router();

router.get('/:name', async (req, res, next) => {
  const name = req.params.name;
  const core = new Set(['GetPlayerAPI','GetStoreAPI','GetLootboxAPI','GetRankedAPI','MailBoxGet','MailBoxRead','MailBoxClaim','MailBoxRemove','GetQuestSkinAPI','GetCurseRelicAPI','Announcement','GetServerVersion','LogReport','LogTransaction','LogStore','LogGetPlayerData']);
  if (core.has(name)) return next();
  try {
    const row = (await q(`SELECT payload FROM ygg_api_cache WHERE name=$1`, [name])).rows[0];
    if (row) return res.json(row.payload);
    return res.json({ ok: true, data: [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name', async (req, res) => {
  const name = req.params.name;
  const body = req.body || {};
  try {
    await q(`INSERT INTO logs (type, player_id, payload) VALUES ($1, $2, $3)`, [name.toLowerCase(), body.playerId || null, body]);
    if (body && typeof body === 'object' && body.payload) {
      await q(`INSERT INTO ygg_api_cache (name, payload) VALUES ($1,$2)
               ON CONFLICT (name) DO UPDATE SET payload = EXCLUDED.payload`, [name, body.payload]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
