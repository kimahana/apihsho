import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { q } from '../../index.js';

const router = Router();

let lastAuth = { request: null, response: null };

function nowTs() { return Math.floor(Date.now()/1000); }
function expTs() { return nowTs() + 3600 * 24; } // 24h

function getField(obj, keys, fallback) {
  for (const k of keys) {
    if (obj && typeof obj === 'object' && obj[k] != null) return obj[k];
  }
  return fallback;
}
function getPlayerId(req) {
  return getField(req.query, ['playerId','uid','userId','id'], null)
      || getField(req.body,  ['playerId','uid','userId','id','steamId','steam_id'], null)
      || req.headers['x-player-id']
      || 'demo-player-001';
}

// Debug endpoint: see what the client posted and what we returned
router.get('/__debug/authen', (req, res) => {
  res.json(lastAuth);
});

router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const playerId = String(getPlayerId(req));
    const steamId  = getField(req.body, ['steamId','steam_id'], playerId);

    // Optional DB seed
    try {
      await q(`INSERT INTO players (player_id, display_name, role, level, exp)
               VALUES ($1, $2, 'Survivor', 1, 0) ON CONFLICT (player_id) DO NOTHING`,
               [playerId, `Player_${playerId.slice(0,6)}`]);
      await q(`INSERT INTO balances (player_id, coin, gem) VALUES ($1,0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO lootbox_balances (player_id, balance) VALUES ($1,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO ranked_stats (player_id, rank_name, rank_point, mmr)
               VALUES ($1,'Bronze',0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    } catch(e) { /* ignore if no DB */ }

    // Template-based response for max compatibility
    const token = 'ok';
    const baseUrl = 'https://apihshow.onrender.com';
    const vars = {
      playerId,
      steamId,
      token,
      expires: String(expTs()),
      serverTime: String(nowTs()),
      baseUrl
    };
    const tplPath = path.join(process.cwd(), 'src', 'templates', 'legacy', 'playerAuthen.json');
    let payload;
    if (fs.existsSync(tplPath)) {
      let raw = fs.readFileSync(tplPath, 'utf8');
      for (const [k,v] of Object.entries(vars)) {
        raw = raw.replaceAll('${'+k+'}', String(v));
      }
      payload = JSON.parse(raw);
    } else {
      payload = {
        error: 0, code: 0, result: true, success: true, status: 'OK', message: 'auth success',
        data: {
          error: 0, code: 0, result: true, success: true, status: 'OK', message: 'auth success',
          playerId, uid: playerId, userId: playerId, id: playerId, steamId,
          token, access_token: token, sessionKey: token, session_token: token,
          expires: expTs(), serverTime: nowTs(), baseUrl,
          endpoints: {
            getPlayer: '/live/player/get',
            storeList: '/live/store/list',
            lootbox: '/live/lootbox/balance',
            ranked: '/live/ranked/info',
            mailbox: '/live/mail/get',
            announcement: '/live/announcement',
            version: '/live/version'
          },
          next: '/live/player/get', redirect: '/live/player/get'
        }
      };
    }

    lastAuth = { request: { headers: req.headers, body: req.body }, response: payload };
    return res.json(payload);
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: 1, code: 1, result: false, success: false, status: 'ERROR', message: e.message });
  }
});

const mapToPlayerAPI = (req, res, next) => {
  req.url = `/YGG/GetPlayerAPI${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return next();
};
router.get(['/live/player/get', '/player/get', '/api/player/get'], mapToPlayerAPI);
router.post(['/live/player/get', '/player/get', '/api/player/get'], mapToPlayerAPI);

export default router;
