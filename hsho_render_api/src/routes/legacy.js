import { Router } from 'express';
import { q } from '../../index.js';

const router = Router();

function getPlayerId(req) {
  return req.query.playerId || req.body?.playerId || req.body?.steamId || req.headers['x-player-id'] || 'demo-player-001';
}

// --- Legacy auth: POST /live/player/authen ---
router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const playerId = getPlayerId(req);
    try {
      await q(`INSERT INTO players (player_id, display_name, role, level, exp)
               VALUES ($1, $2, 'Survivor', 1, 0) ON CONFLICT (player_id) DO NOTHING`,
               [playerId, `Player_${String(playerId).slice(0,6)}`]);
      await q(`INSERT INTO balances (player_id, coin, gem) VALUES ($1,0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO lootbox_balances (player_id, balance) VALUES ($1,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO ranked_stats (player_id, rank_name, rank_point, mmr) VALUES ($1,'Bronze',0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    } catch(e) { /* ignore if DB not configured */ }
    return res.json({ error: 0, playerId, token: 'ok', message: 'auth success' });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: 1, message: e.message });
  }
});

// --- Legacy player info: GET /live/player/get ---
router.get(['/live/player/get', '/player/get', '/api/player/get'], async (req, res, next) => {
  req.url = `/YGG/GetPlayerAPI${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return next();
});

// --- Legacy store list: GET /live/store/list ---
router.get(['/live/store/list', '/store/list', '/api/store/list'], async (req, res, next) => {
  req.url = '/YGG/GetStoreAPI';
  return next();
});

// --- Legacy lootbox balance: GET /live/lootbox/balance ---
router.get(['/live/lootbox/balance', '/lootbox/balance', '/api/lootbox/balance'], async (req, res, next) => {
  req.url = `/YGG/GetLootboxAPI${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return next();
});

// --- Legacy ranked info: GET /live/ranked/info ---
router.get(['/live/ranked/info', '/ranked/info', '/api/ranked/info'], async (req, res, next) => {
  req.url = `/YGG/GetRankedAPI${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return next();
});

// --- Legacy mailbox: GET /live/mail/get ---
router.get(['/live/mail/get', '/mail/get', '/api/mail/get'], async (req, res, next) => {
  req.url = '/YGG/MailBoxGet';
  return next();
});

// --- Legacy announcement/version ---
router.get(['/live/announcement', '/announcement'], async (req, res, next) => {
  req.url = '/YGG/Announcement'; return next();
});
router.get(['/live/version', '/version'], async (req, res, next) => {
  req.url = '/YGG/GetServerVersion'; return next();
});

export default router;
