import { Router } from 'express';
import { q } from '../../index.js';

const router = Router();

function nowTs() { return Math.floor(Date.now()/1000); }
function expTs() { return nowTs() + 3600 * 24; } // 24h

function getPlayerId(req) {
  return req.query.playerId || req.body?.playerId || req.body?.steamId || req.headers['x-player-id'] || 'demo-player-001';
}

router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const playerId = getPlayerId(req);
    try {
      await q(`INSERT INTO players (player_id, display_name, role, level, exp)
               VALUES ($1, $2, 'Survivor', 1, 0) ON CONFLICT (player_id) DO NOTHING`,
               [playerId, `Player_${String(playerId).slice(0,6)}`]);
      await q(`INSERT INTO balances (player_id, coin, gem) VALUES ($1,0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO lootbox_balances (player_id, balance) VALUES ($1,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO ranked_stats (player_id, rank_name, rank_point, mmr)
               VALUES ($1,'Bronze',0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    } catch(e) { /* ignore if DB not configured */ }

    const token = 'ok';
    const baseUrl = 'https://apihshow.onrender.com';
    const endpoints = {
      getPlayer: '/live/player/get',
      storeList: '/live/store/list',
      lootbox: '/live/lootbox/balance',
      ranked: '/live/ranked/info',
      mailbox: '/live/mail/get',
      announcement: '/live/announcement',
      version: '/live/version'
    };

    // top-level + nested "data" for compatibility
    return res.json({
      error: 0,
      message: 'auth success',
      playerId,
      uid: playerId,
      token,
      access_token: token,
      sessionKey: token,
      session_token: token,
      expires: expTs(),
      serverTime: nowTs(),
      baseUrl,
      endpoints,
      data: {
        error: 0,
        message: 'auth success',
        playerId,
        uid: playerId,
        token,
        access_token: token,
        sessionKey: token,
        session_token: token,
        expires: expTs(),
        serverTime: nowTs(),
        baseUrl,
        endpoints
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: 1, message: e.message });
  }
});

const mapToPlayerAPI = (req, res, next) => {
  req.url = `/YGG/GetPlayerAPI${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return next();
};
router.get(['/live/player/get', '/player/get', '/api/player/get'], mapToPlayerAPI);
router.post(['/live/player/get', '/player/get', '/api/player/get'], mapToPlayerAPI);

export default router;
