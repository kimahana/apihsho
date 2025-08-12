import { Router } from 'express';
import { q } from '../../index.js';

const router = Router();

// Legacy auth endpoint: POST /live/player/authen
router.post(['/live/player/authen', '/player/authen', '/api/player/authen'], async (req, res) => {
  try {
    const playerId = req.body?.playerId || req.body?.steamId || 'demo-player-001';
    // ensure minimal player rows exist if DB available
    try {
      await q(`INSERT INTO players (player_id, display_name, role, level, exp)
               VALUES ($1, $2, 'Survivor', 1, 0)
               ON CONFLICT (player_id) DO NOTHING`, [playerId, `Player_${String(playerId).slice(0,6)}`]);
      await q(`INSERT INTO balances (player_id, coin, gem) VALUES ($1,0,0)
               ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO lootbox_balances (player_id, balance) VALUES ($1,0)
               ON CONFLICT (player_id) DO NOTHING`, [playerId]);
      await q(`INSERT INTO ranked_stats (player_id, rank_name, rank_point, mmr)
               VALUES ($1,'Bronze',0,0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    } catch(e) { /* ignore if no DB */ }

    // Return a structure old clients usually expect
    return res.json({
      error: 0,
      playerId,
      token: 'ok',
      message: 'auth success'
    });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: 1, message: e.message });
  }
});

export default router;
