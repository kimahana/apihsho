
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || 'https://apihshow.onrender.com';

function nowSec() { return Math.floor(Date.now()/1000); }
function md5(s) { return crypto.createHash('md5').update(s).digest('hex'); }
function shortIdFromTicket(ticket) {
  // take 8 hex-ish chars from middle if possible; fallback random
  if (typeof ticket === 'string' && ticket.length >= 16) {
    const mid = Math.floor(ticket.length/2);
    return 'p_' + ticket.substring(mid-4, mid+4).toLowerCase().replace(/[^0-9a-f]/g,'') || ('p_' + Math.random().toString(16).slice(2,10));
  }
  return 'p_' + Math.random().toString(16).slice(2,10);
}

const endpoints = {
  getPlayer: "/live/player/get",
  playerGet: "/live/player/get",
  player: "/live/player/get",
  storeList: "/live/store/list",
  store_list: "/live/store/list",
  lootbox: "/live/lootbox/balance",
  ranked: "/live/ranked/info",
  mailbox: "/live/mail/get",
  announcement: "/live/announcement",
  version: "/live/version",
};

function authResponse(reqBody = {}) {
  const serverTime = nowSec();
  const expiresIn = 86400;
  const expires = serverTime + expiresIn;
  const ticket = reqBody.ticket || 'ticket';
  const pid = shortIdFromTicket(ticket);
  const token = md5(ticket).slice(0,32);

  const userObj = {
    id: pid, uid: pid, userId: pid, playerId: pid, steamId: pid,
    name: 'Player_' + (pid.slice(-6)),
    token, access_token: token, sessionKey: token, session_token: token,
    sessionId: token, session_id: token,
    createdAt: serverTime, updatedAt: serverTime,
  };

  const baseFields = {
    error: 0, code: 0, err: 0, errno: 0,
    Error: 0, ErrorCode: 0, rc: 0, ret: 0,
    error_str: "0", code_str: "0",
    statusCode: 0, status_code: 0, ResponseCode: 0,
    result: true, success: true, ok: true, status: "OK",
    httpCode: 200, resultCode: 0,
  };

  const tokenMap = {
    token, access_token: token, accessToken: token, "access-token": token,
    sessionKey: token, session_token: token, sessionId: token, session_id: token,
    session: token, sid: token,
  };

  const serverObj = {
    api: BASE_URL,
    base: BASE_URL,
    time: serverTime,
    region: "sg"
  };

  const resp = {
    ...baseFields,
    message: "auth success",
    Message: "auth success",
    msg: "auth success",
    playerId: pid, uid: pid, userId: pid, id: pid, steamId: pid,
    player_id: pid, steam_id: pid,
    ticket: ticket,
    authType: reqBody.authType || 'steam',
    clientversion: reqBody.clientversion || reqBody.clientVersion || '1.0.6.0',
    clientVersion: reqBody.clientVersion || '1.0.6.0',
    version: reqBody.clientVersion || '1.0.6.0',
    expires, expiresIn, serverTime,
    baseUrl: BASE_URL, base_url: BASE_URL, api_base: BASE_URL, server_url: BASE_URL, host: BASE_URL,
    server: serverObj,
    endpoints, endpoint: endpoints, api: endpoints,
    next: endpoints.getPlayer,
    redirect: endpoints.getPlayer,
    user: { ...userObj },
    profile: {
      level: 1, exp: 0, role: "Survivor",
      rank: { name: "Bronze", point: 0, mmr: 0 },
      balance: { coin: 0, gem: 0 },
      lootbox: { balance: 0 }
    },
    response: { params: { result: "OK", steamid: pid, playerid: pid, token }, error: null },
    data: {},
    ...tokenMap
  };
  return resp;
}

// Simple "OK"
app.get('/health', (req, res) => res.status(200).send('OK'));

// Mirror auth shape for debugging
app.get('/__debug/authen', (req, res) => {
  const sampleBody = { authType: 'steam', ticket: crypto.randomBytes(16).toString('hex'), clientVersion: '1.0.6.0' };
  res.json(authResponse(sampleBody));
});

app.post('/live/player/authen', (req, res) => {
  try {
    const body = req.body || {};
    const resp = authResponse(body);
    res.json(resp);
  } catch (e) {
    console.error('authen error', e);
    res.status(200).json({ error: 1, code: 1, status: "ERROR", message: String(e) });
  }
});

app.get('/live/player/get', (req, res) => {
  const t = nowSec();
  const pid = 'p_' + Math.random().toString(16).slice(2,10);
  const token = md5(String(Math.random()));
  res.json({
    error: 0, code: 0, status: "OK", httpCode: 200,
    message: "OK",
    playerId: pid, uid: pid, userId: pid, id: pid, steamId: pid,
    token, access_token: token, accessToken: token, sessionKey: token,
    baseUrl: BASE_URL, serverTime: t,
    profile: {
      level: 1, exp: 0, role: "Survivor",
      rank: { name: "Bronze", point: 0, mmr: 0 },
      balance: { coin: 0, gem: 0 },
      lootbox: { balance: 0 }
    },
    endpoints, server: { api: BASE_URL, base: BASE_URL, time: t, region: "sg" }
  });
});

app.get('/live/store/list', (req, res) => {
  res.json({ error:0, code:0, status:"OK", httpCode:200, items:[] });
});

app.get('/live/lootbox/balance', (req, res) => {
  res.json({ error:0, code:0, status:"OK", httpCode:200, balance:0 });
});

app.get('/live/ranked/info', (req, res) => {
  res.json({ error:0, code:0, status:"OK", httpCode:200, rank:{ name:"Bronze", point:0, mmr:0 } });
});

app.get('/live/mail/get', (req, res) => {
  res.json({ error:0, code:0, status:"OK", httpCode:200, mail:[] });
});

app.get('/live/announcement', (req, res) => {
  res.json({ error:0, code:0, status:"OK", httpCode:200, messages:[] });
});

app.get('/live/version', (req, res) => {
  res.json({ error:0, code:0, status:"OK", httpCode:200, clientVersion:"1.0.6.0", version:"1.0.6.0" });
});

app.listen(PORT, () => {
  console.log(`[DB] Schema ensured.`);
  console.log(`Server listening on :${PORT}`);
});
