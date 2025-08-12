INSERT INTO players (player_id, display_name, role, level, exp)
VALUES ('demo-player-001','Player_demo','Survivor',1,0)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO balances (player_id, coin, gem)
VALUES ('demo-player-001',0,0)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO lootbox_balances (player_id, balance)
VALUES ('demo-player-001',0)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO ranked_stats (player_id, rank_name, rank_point, mmr)
VALUES ('demo-player-001','Bronze',0,0)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO store_products (short_code, name, price_base, currency, tags)
VALUES ('STARTER_PACK','Starter Pack',0,'Coin',ARRAY['starter'])
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO ygg_api_cache (name, payload)
VALUES ('Announcement', '{"announcements": []}')
ON CONFLICT (name) DO NOTHING;

INSERT INTO ygg_api_cache (name, payload)
VALUES ('GetServerVersion', '{"version":"1.0.0","message":""}')
ON CONFLICT (name) DO NOTHING;
