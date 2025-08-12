import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import url from 'url';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const PORT = process.env.PORT || 10000;

// Postgres Pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function q(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function autoMigrate() {
  const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await q(schema);
  console.log('[DB] Schema ensured.');

  // Seed only if empty
  const { rows } = await q('SELECT COUNT(*)::int AS n FROM ygg_api_cache');
  if (rows[0].n === 0) {
    const seed = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8');
    await q(seed);
    console.log('[DB] Seed inserted.');
  }
}

// Health
app.get('/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Specialized cores
import yggCore from './routes/ygg_core.js';
app.use('/YGG', yggCore);

// Generic catch-all
import yggGeneric from './routes/ygg_generic.js';
app.use('/YGG', yggGeneric);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

autoMigrate().then(() => {
  app.listen(PORT, () => console.log(`Server on :${PORT}`));
}).catch(err => {
  console.error('Start failed:', err);
  process.exit(1);
});
