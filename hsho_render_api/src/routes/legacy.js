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

// Produce a plausible 17-digit SteamID64 if we don't have a real one
function makeSteam64FromTicket(ticket) {
  const base = BigInt('76561197960265728'); // base for SteamID64
  const h = crypto.createHash('sha256').update(String(ticket||'')).digest();
  // use first 8 bytes as unsigned integer
  const v = BigInt.asUintN(64, BigInt('0x' + h.subarray(0,8).toString('hex')));
  const id64 = base + (v % BigInt(10_000_000_000)); // keep in reasonable range
  return id64.toString(); // 17 digits
}

router.get('/__debug/authen', (req, res) => res.json(lastAuth || {}));

router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const body = req.body || {};
    const baseUrl = 'https://apihshow.onrender.com';

    const ticket = getField(body, ['ticket','authTicket','access_ticket'], '');
    const clientVersion = getField(body, ['clientversion','clientVersion','version'], '1.0.0');

    // Prefer env-provided numeric steam id if present (future), else synthesize numeric SteamID64
    const steam64 = makeSteam64FromTicket(ticket);
    const playerId = steam64; // use numeric-like id everywhere
    const steamId  = steam64;
    const token    = crypto.createHash('sha256').update(String(ticket || steam64) + ':' + nowTs()).digest('hex');

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

    const flags = {
      error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0, rc: 0, ret: 0,
      error_str: '0', code_str: '0', statusCode: 0, status_code: 0, ResponseCode: 0,
      result: true, success: true, ok: true, status: 'OK', httpCode: 200, resultCode: 0,
      message: 'auth success', Message: 'auth success', msg: 'auth success'
    };

    const user = {
      id: playerId, uid: playerId, userId: playerId, playerId, steamId,
      name: `Player_${playerId.slice(-6)}`,
      token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token
    };

    const server = { api: baseUrl, base: baseUrl, time: nowTs(), region: 'sg' };

    const base = {
      ...flags,
      playerId, uid: playerId, userId: playerId, id: playerId, steamId,
      player_id: playerId, steam_id: steamId,
      token, access_token: token, accessToken: token, 'access-token': token,
      sessionKey: token, session_token: token, sessionId: token, session_id: token, session: token, sid: token,
      ticket, authType: body.authType || 'steam',
      clientversion: clientVersion, clientVersion, version: clientVersion,
      expires: expTs(), expiresIn: 86400, serverTime: nowTs(),
      baseUrl, base_url: baseUrl, api_base: baseUrl, server_url: baseUrl, host: baseUrl,
      server,
      endpoints, endpoint: endpoints, api: endpoints, next: '/live/player/get', redirect: '/live/player/get',
      user,
      profile: { level: 1, exp: 0, role: 'Survivor', rank: { name: 'Bronze', point: 0, mmr: 0 }, balance: { coin: 0, gem: 0 }, lootbox: { balance: 0 } },
      // also include steam-like wrapper
      response: { params: { result: 'OK', steamid: steamId, playerid: playerId, token }, error: null }
    };

    const full = { ...base, data: { ...base } };
    lastAuth = { request: { headers: req.headers, body }, response: full };
    return res.json(full);
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
