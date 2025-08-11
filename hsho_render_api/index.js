/**
 * HSHO mock API (always success)
 * Paths: /live/* -> { error:0, success:true, ... }
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS + JSON
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging to console + file
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'requests.log'), { flags: 'a' });
app.use(morgan('[:date[iso]] :method :url :status - :response-time ms', { stream: accessLogStream }));
app.use(morgan('dev'));

// Health endpoints
app.get('/', (req, res) => res.json({ ok: true, message: 'HSHO mock API running', ts: new Date().toISOString() }));
app.get('/live/health', (req, res) => res.json({ error: 0, success: true, message: 'healthy' }));
app.get('/live/ping', (req, res) => res.json({ error: 0, success: true, pong: true }));

// Example specific endpoints (optional)
app.post('/live/player/login', (req, res) => {
  const playerId = (req.body && (req.body.playerId || req.body.player_id)) || 'mock-player';
  res.json({
    error: 0,
    success: true,
    data: {
      playerId,
      token: 'mock-token-' + Date.now(),
      profile: { name: 'Mock', level: 1 }
    }
  });
});

app.get('/live/store/products', (req, res) => {
  res.json({
    error: 0,
    success: true,
    products: [
      { id: 'p1', name: 'Starter Pack', price: 0 },
      { id: 'p2', name: 'Skin Bundle', price: 0 }
    ]
  });
});

// Catch-all for any /live/* path
app.all('/live/*', (req, res) => {
  res.json({
    error: 0,
    success: true,
    path: req.path,
    method: req.method,
    echo: { query: req.query, body: req.body },
    message: 'OK',
    ts: new Date().toISOString()
  });
});

// 404 for other paths
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not Found', path: req.path });
});

app.listen(PORT, () => {
  console.log(`[HSHO] Mock API listening on http://0.0.0.0:${PORT}`);
});
