import express from 'express';
import { auth } from '../middleware/auth';
import { GameAnalytics } from '../services/GameAnalytics';
import { Logger } from '../utils/logger';
import { User } from '../models/User';
import { GameHistory } from '../models/GameHistory';

const router = express.Router();
const gameAnalytics = new GameAnalytics();

// 保存游戏分数
router.post('/:gameId/scores', auth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { score, won } = req.body;
    const userId = req.user._id;

    await gameAnalytics.recordGamePlay(userId, gameId, score, won);

    // 更新用户统计
    const user = await User.findById(userId);
    if (user) {
      user.gameStats.gamesPlayed += 1;
      if (won) {
        user.gameStats.wins += 1;
      } else {
        user.gameStats.losses += 1;
      }

      // 更新最高分
      const currentHighScore = user.gameStats.highScores.get(gameId) || 0;
      if (score > currentHighScore) {
        user.gameStats.highScores.set(gameId, score);
      }

      await user.save();
    }

    Logger.info('Game score recorded', { userId, gameId, score, won });
    
    res.status(200).json({ message: 'Score saved successfully' });
  } catch (error) {
    Logger.error('Error saving game score', error as Error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// 获取游戏排行榜
router.get('/:gameId/leaderboard', async (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const leaderboardData = await gameAnalytics.getGameStats(gameId);
    if (!leaderboardData) {
      return res.status(404).json({ error: 'Game stats not found' });
    }

    // 获取用户详细信息
    const topPlayersWithDetails = await Promise.all(
      leaderboardData.topPlayers.slice(0, limit).map(async (player) => {
        const user = await User.findById(player.userId).select('username avatar');
        return {
          ...player,
          username: user ? user.username : 'Unknown',
          avatar: user ? user.avatar : null
        };
      })
    );

    res.status(200).json(topPlayersWithDetails);
  } catch (error) {
    Logger.error('Error getting game leaderboard', error as Error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// 获取游戏统计
router.get('/:gameId/stats', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    const stats = await gameAnalytics.getGameStats(gameId);
    if (!stats) {
      return res.status(404).json({ error: 'Game stats not found' });
    }
    
    res.status(200).json(stats);
  } catch (error) {
    Logger.error('Error getting game stats', error as Error);
    res.status(500).json({ error: 'Failed to get game stats' });
  }
});

// 获取用户的游戏历史
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { gameId, page = 1, limit = 10 } = req.query;
    
    // 检查用户权限
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to user data' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 添加分页逻辑
    const skip = (Number(page) - 1) * Number(limit);
    const gameHistory = await GameHistory.find({ userId, gameId })
      .skip(skip)
      .limit(Number(limit))
      .sort({ timestamp: -1 });

    res.status(200).json({
      total: await GameHistory.countDocuments({ userId, gameId }),
      page: Number(page),
      limit: Number(limit),
      data: gameHistory
    });
  } catch (error) {
    Logger.error('Error getting user game history', error as Error);
    res.status(500).json({ error: 'Failed to get user game history' });
  }
});

export default router; 