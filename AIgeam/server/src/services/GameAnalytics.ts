import { Redis } from 'ioredis';
import { User } from '../models/User';
import { createClient } from 'redis';

export class GameAnalytics {
  private redis: Redis;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL
    }) as Redis;
  }

  async recordGamePlay(userId: string, gameId: string, score: number, won: boolean) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // 更新用户统计
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

      // 记录实时统计到Redis
      await this.redis.hincrby(`game:${gameId}:stats`, 'totalPlays', 1);
      await this.redis.hincrby(`game:${gameId}:stats`, won ? 'wins' : 'losses', 1);
      await this.redis.zadd(`game:${gameId}:leaderboard`, score, userId);
    } catch (error) {
      console.error('Error recording game analytics:', error);
    }
  }

  async getGameStats(gameId: string) {
    try {
      const stats = await this.redis.hgetall(`game:${gameId}:stats`);
      const topPlayers = await this.redis.zrevrange(`game:${gameId}:leaderboard`, 0, 9, 'WITHSCORES');
      
      return {
        totalPlays: parseInt(stats.totalPlays || '0'),
        wins: parseInt(stats.wins || '0'),
        losses: parseInt(stats.losses || '0'),
        topPlayers: this.formatLeaderboard(topPlayers)
      };
    } catch (error) {
      console.error('Error getting game stats:', error);
      return null;
    }
  }

  private formatLeaderboard(leaderboardData: string[]) {
    const formatted = [];
    for (let i = 0; i < leaderboardData.length; i += 2) {
      formatted.push({
        userId: leaderboardData[i],
        score: parseInt(leaderboardData[i + 1])
      });
    }
    return formatted;
  }
} 