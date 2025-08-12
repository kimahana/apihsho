import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

let lastAuth = { request: null, response: null, steam: null };

function nowTs() { return Math.floor(Date.now()/1000); }
function expTs() { return nowTs() + 3600 * 24; } // 24h

function getField(obj, keys, fallback) {
  for (const k of keys) {
    if (obj && typeof obj === 'object' && obj[k] != null) return obj[k];
  }
  return fallback;
}

async function verifySteamTicket(ticket) {
  const key = process.env.STEAM_API_KEY || '';
  const appid = process.env.STEAM_APPID || '480';
  if (!key || !ticket) return { ok: false, reason: 'missing_key_or_ticket' };
  const url = `https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/?key=${encodeURIComponent(key)}&appid=${encodeURIComponent(appid)}&ticket=${encodeURIComponent(ticket)}`;
  try {
    const r = await fetch(url, { method: 'POST' });
    const json = await r.json();
    const resp = json?.response || {};
    if (resp?.error) return { ok: false, reason: resp.error.errordesc || 'steam_error', raw: json };
    const sid = resp?.params?.steamid || resp?.params?.steamID || null;
    const result = (resp?.params?.result || '').toUpperCase();
    if (sid && result === 'OK') return { ok: true, steamid: String(sid), raw: json };
    return { ok: false, reason: 'invalid_ticket', raw: json };
  } catch (e) {
    return { ok: false, reason: 'network_error', error: String(e) };
  }
}

// Debug endpoints
router.get('/__debug/authen', (req, res) => res.json(lastAuth || {}));
router.get('/debug/auth', (req, res) => res.json(lastAuth || {}));

router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const body = req.body || {};
    const baseUrl = 'https://apihshow.onrender.com';

    const ticket = getField(body, ['ticket','authTicket','access_ticket'], '');

    let steam = null;
    if (process.env.STEAM_API_KEY) {
      steam = await verifySteamTicket(ticket);
    }

    const derivedSteamId = steam?.ok ? steam.steamid : null;
    const playerId = getField(body, ['playerId','uid','userId','id'], derivedSteamId || 'p_' + crypto.createHash('sha256').update(String(ticket)).digest('hex').slice(0,16));
    const steamId  = getField(body, ['steamId','steam_id'], derivedSteamId || playerId);
    const token    = crypto.createHash('sha256').update(String(ticket || playerId) + ':' + nowTs()).digest('hex');

    const endpoints = {
      getPlayer: '/live/player/get',
      playerGet: '/live/player/get',
      player: '/live/player/get',
      storeList: '/live/store/list',
      store_list: '/live/store/list',
      lootbox: '/live/lootbox/balance',
      ranked: '/live/ranked/info',
      mailbox: '/live/mail/get',
      announcement: '/live/announcement',
      version: '/live/version'
    };

    const user = {
      id: playerId,
      uid: playerId,
      userId: playerId,
      playerId,
      steamId,
      name: `Player_${playerId.slice(-6)}`,
      token,
      access_token: token,
      sessionKey: token,
      session_token: token,
      sessionId: token,
      session_id: token,
      createdAt: nowTs(),
      updatedAt: nowTs()
    };

    const profile = {
      level: 1,
      exp: 0,
      role: 'Survivor',
      rank: { name: 'Bronze', point: 0, mmr: 0 },
      balance: { coin: 0, gem: 0 },
      lootbox: { balance: 0 }
    };

    const flags = {
      error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0, rc: 0, ret: 0,
      error_str: '0', code_str: '0', statusCode: 0, status_code: 0, ResponseCode: 0,
      result: true, success: true, ok: true, status: 'OK', httpCode: 200, resultCode: 0,
      message: 'auth success', Message: 'auth success', msg: 'auth success'
    };

    const server = { api: baseUrl, base: baseUrl, time: nowTs(), region: 'sg' };

    const base = {
      ...flags,
      playerId, uid: playerId, userId: playerId, id: playerId, steamId,
      token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token,
      ticket, authType: body.authType || 'steam',
      expires: expTs(), expiresIn: 86400, serverTime: nowTs(),
      baseUrl, base_url: baseUrl, api_base: baseUrl, server_url: baseUrl, host: baseUrl,
      server,
      endpoints, endpoint: endpoints, next: '/live/player/get', redirect: '/live/player/get',
      user, profile
    };

    const response = { ...base, data: { ...base } };
    lastAuth = { request: { headers: req.headers, body }, response, steam };
    return res.json(response);
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
