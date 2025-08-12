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
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const seedPath = path.join(__dirname, 'db', 'seed.sql');
    if (fs.existsSync(schemaPath)) {
      await q(fs.readFileSync(schemaPath, 'utf8'));
      console.log('[DB] Schema ensured.');
    }
    // seed only when cache is empty
    const r = await q('SELECT to_regclass($1) AS t', ['ygg_api_cache']);
    if (r.rows[0].t) {
      const { rows } = await q('SELECT COUNT(*)::int AS n FROM ygg_api_cache');
      if (rows[0].n === 0 && fs.existsSync(seedPath)) {
        await q(fs.readFileSync(seedPath, 'utf8'));
        console.log('[DB] Seed inserted.');
      }
    }
  } catch (err) {
    console.warn('[DB] Auto-migrate skipped:', err.message);
  }
}

// Health
app.get('/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: true, db: 'not configured' });
  }
});

// YGG routes
import yggCore from './src/routes/ygg_core.js';
import yggGeneric from './src/routes/ygg_generic.js';
app.use('/YGG', yggCore);
app.use('/YGG', yggGeneric);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

autoMigrate().then(() => {
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}).catch(err => {
  console.error('Start failed:', err);
  process.exit(1);
});
