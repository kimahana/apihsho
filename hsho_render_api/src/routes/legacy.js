import { Router } from 'express';
import crypto from 'crypto';

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

// Robust debug endpoints
router.get('/__debug/authen', (req, res) => res.json(lastAuth || {}));
router.get('/debug/auth', (req, res) => res.json(lastAuth || {}));

router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const body = req.body || {};
    const playerId = String(getPlayerId(req));
    const steamId  = getField(body, ['steamId','steam_id'], playerId);
    const ticket   = getField(body, ['ticket','authTicket','access_ticket'], '');
    const tokenRaw = ticket || (playerId + ':' + nowTs());
    const token    = crypto.createHash('sha256').update(tokenRaw).digest('hex');

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

    const top = {
      // success flags (numeric + string)
      error: 0, code: 0, err: 0, Error: 0, ErrorCode: 0,
      'error_str': '0', 'code_str': '0',
      result: true, success: true, status: 'OK', httpCode: 200,
      message: 'auth success', Message: 'auth success', msg: 'auth success',
      // ids
      playerId, uid: playerId, userId: playerId, id: playerId, steamId,
      // tokens
      token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token,
      ticket, authType: body.authType || 'steam',
      // times
      expires: expTs(), expiresIn: 86400, serverTime: nowTs(),
      // server hints
      baseUrl, base_url: baseUrl, api_base: baseUrl, server_url: baseUrl,
      server: { api: baseUrl, base: baseUrl, time: nowTs(), region: 'sg' },
      endpoints,
      next: '/live/player/get', redirect: '/live/player/get',
      // echo original body for compatibility
      echo: body
    };

    const response = { ...top, data: { ...top } };
    lastAuth = { request: { headers: req.headers, body }, response };
    return res.json(response);
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: 1, code: 1, result: false, success: false, status: 'ERROR', message: e.message });
  }
});

// Map old player/get to new API (GET or POST)
const mapToPlayerAPI = (req, res, next) => {
  req.url = `/YGG/GetPlayerAPI${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return next();
};
router.get(['/live/player/get', '/player/get', '/api/player/get'], mapToPlayerAPI);
router.post(['/live/player/get', '/player/get', '/api/player/get'], mapToPlayerAPI);

export default router;
