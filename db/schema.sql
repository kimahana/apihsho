CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT,
  level INT DEFAULT 1,
  exp INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS balances (
  player_id TEXT PRIMARY KEY REFERENCES players(player_id),
  coin INT DEFAULT 0,
  gem INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lootbox_balances (
  player_id TEXT PRIMARY KEY REFERENCES players(player_id),
  balance INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  player_id TEXT REFERENCES players(player_id),
  item_type TEXT,
  short_code TEXT,
  quantity INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ranked_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(player_id),
  rank_name TEXT,
  rank_point INT DEFAULT 0,
  mmr INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS store_products (
  short_code TEXT PRIMARY KEY,
  name TEXT,
  price_base INT,
  currency TEXT,
  tags TEXT[]
);

CREATE TABLE IF NOT EXISTS ygg_api_cache (
  name TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  type TEXT,
  player_id TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
