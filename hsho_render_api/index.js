import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

// Optional PG; app works without a DATABASE_URL
let pgPool = null;
try {
  const { Pool } = await import("pg");
  if (process.env.DATABASE_URL) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
} catch {
  // pg not available in some environments; that's fine
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;
const BASE = process.env.PUBLIC_BASE_URL || "https://apihshow.onrender.com";

// In-memory debug holders
let lastAuth = { note: "no auth yet" };
let lastPlayer = { note: "no player get yet" };

async function ensureSchema() {
  if (!pgPool) return;
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS players(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions(
        session TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );
    `);
    console.log("[DB] Schema ensured.");
  } finally {
    client.release();
  }
}

function pickIdFromTicket(ticket = "") {
  // Extract 8 hex chars from the ticket to mimic your previous "p_XXXXXXXX" style.
  const m = /14000000([0-9A-Fa-f]{8})/.exec(ticket);
  return "p_" + (m ? m[1].toLowerCase() : (ticket.slice(8, 16) || "demo").toLowerCase());
}

function makeToken(seed) {
  // 32 hex chars; stable but simple
  return hashlib(seed).slice(0, 64).slice(0, 32);
}
function hashlib(s) {
  // quick hash for token/session
  const data = Buffer.from(String(s));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  // to hex
  const hex = ("00000000" + h.toString(16)).slice(-8);
  // repeat to 32 chars
  return (hex + hex + hex + hex);
}

// Health
app.get("/health", (req, res) => res.status(200).send("ok"));

// Debug endpoints
app.get("/__debug/authen", (req, res) => res.json(lastAuth));
app.get("/__debug/player", (req, res) => res.json(lastPlayer));

// Auth
app.post("/live/player/authen", async (req, res) => {
  const headers = req.headers || {};
  const body = req.body || {};
  const ticket = String(body.ticket || "");
  const authType = body.authType || "steam";
  const clientversion = body.clientversion || body.clientVersion || "1.0.6.0";
  const macaddress = body.macaddress || "00:00:00:00:00:00";

  const playerId = pickIdFromTicket(ticket);
  const token = makeToken(playerId + ":" + ticket);
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60;
  const expires = now + expiresIn;

  // optional DB store
  if (pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO players (id, name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
        [playerId, "Player_" + playerId.slice(-6)]
      );
      await pgPool.query(
        `INSERT INTO sessions (session, player_id, expires_at) VALUES ($1,$2, to_timestamp($3)) 
         ON CONFLICT (session) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
        [token, playerId, expires]
      );
    } catch (e) {
      console.log("DB write skipped:", e.message || e);
    }
  }

  const payload = {
    error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0, rc: 0, ret: 0,
    error_str: "0", code_str: "0", statusCode: 0, status_code: 0, ResponseCode: 0,
    result: true, success: true, ok: true, status: "OK", httpCode: 200,
    message: "auth success", Message: "auth success", msg: "auth success",
    playerId: playerId, uid: playerId, userId: playerId, id: playerId,
    steamId: playerId, player_id: playerId, steam_id: playerId,
    token, access_token: token, accessToken: token, "access-token": token,
    sessionKey: token, session_token: token, sessionId: token, session_id: token,
    session: token, sid: token,
    ticket, authType,
    clientversion, clientVersion: clientversion, version: clientversion,
    expires, expiresIn, serverTime: now,
    baseUrl: BASE, base_url: BASE, api_base: BASE, server_url: BASE, host: BASE,
    server: { api: BASE, base: BASE, time: now, region: "sg" },
    endpoints: {
      getPlayer: "/live/player/get",
      playerGet: "/live/player/get",
      player: "/live/player/get",
      storeList: "/live/store/list",
      store_list: "/live/store/list",
      lootbox: "/live/lootbox/balance",
      ranked: "/live/ranked/info",
      mailbox: "/live/mail/get",
      announcement: "/live/announcement",
      version: "/live/version"
    },
    next: "/live/player/get",
    redirect: "/live/player/get",
    user: {
      id: playerId, uid: playerId, userId: playerId, playerId,
      steamId: playerId, name: "Player_" + playerId.slice(-6),
      token, access_token: token, sessionKey: token, session_token: token,
      sessionId: token, session_id: token, createdAt: now, updatedAt: now
    },
    profile: {
      level: 1, exp: 0, role: "Survivor",
      rank: { name: "Bronze", point: 0, mmr: 0 },
      balance: { coin: 0, gem: 0 },
      lootbox: { balance: 0 }
    },
    response: { params: { result: "OK", steamid: playerId, playerid: playerId, token }, error: null },
    data: {}
  };
  payload.data = JSON.parse(JSON.stringify(payload)); // mirror into data

  lastAuth = { request: { headers, body }, response: payload };
  res.json(payload);
});

function readAuthToken(req) {
  const h = req.headers || {};
  // Bearer token
  const auth = (h.authorization || "").trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "");
  // Basic xxx: (game sometimes sends Basic eHh4Og==), allow token in ?token= as fallback
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

// Player Get
app.get("/live/player/get", async (req, res) => {
  const token = readAuthToken(req);
  const now = Math.floor(Date.now() / 1000);
  const base = BASE;

  // derive a fake player id from token for demo, or fallback
  const playerId = token ? "p_" + (token.slice(0, 8)) : "p_demo";
  const profile = {
    level: 1, exp: 0, role: "Survivor",
    rank: { name: "Bronze", point: 0, mmr: 0 },
    balance: { coin: 0, gem: 0 },
    lootbox: { balance: 0 }
  };

  const payload = {
    error: 0, code: 0, result: true, success: true, status: "OK", httpCode: 200,
    message: "player ok",
    playerId, uid: playerId, userId: playerId, id: playerId,
    token, serverTime: now, baseUrl: base, api_base: base, server_url: base,
    user: { id: playerId, name: "Player_" + playerId.slice(-6), createdAt: now, updatedAt: now },
    profile, inventory: [], mailbox: [], announcement: [],
  };
  lastPlayer = { request: { headers: req.headers }, response: payload };
  res.json(payload);
});

// Minimal stubs for other routes the client might ping
app.get("/live/store/list", (req, res) => res.json({ error: 0, code: 0, success: true, items: [] }));
app.get("/live/lootbox/balance", (req, res) => res.json({ error: 0, code: 0, success: true, balance: 0 }));
app.get("/live/ranked/info", (req, res) => res.json({ error: 0, code: 0, success: true, mmr: 0 }));
app.get("/live/mail/get", (req, res) => res.json({ error: 0, code: 0, success: true, mails: [] }));
app.get("/live/announcement", (req, res) => res.json({ error: 0, code: 0, success: true, list: [] }));
app.get("/live/version", (req, res) => res.json({ error: 0, code: 0, success: true, version: "1.0.6.0" }));

// root
app.get("/", (req, res) => res.redirect("/health"));

await ensureSchema();
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
