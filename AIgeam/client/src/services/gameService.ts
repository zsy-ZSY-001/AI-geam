import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export interface GameScore {
  userId: string;
  gameId: string;
  score: number;
  timestamp: Date;
  won: boolean;
}

export interface GameStats {
  totalPlays: number;
  wins: number;
  losses: number;
  topPlayers: Array<{
    userId: string;
    username: string;
    score: number;
    timestamp: Date;
  }>;
}

/**
 * 保存游戏分数
 * @param gameId 游戏ID
 * @param userId 用户ID
 * @param score 分数
 * @param won 是否获胜
 * @returns 保存结果
 */
export const saveGameScore = async (
  gameId: string,
  userId: string,
  score: number,
  won: boolean
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await axios.post(`${API_URL}/games/${gameId}/scores`, {
      userId,
      score,
      won,
    });
    return { success: true, ...response.data };
  } catch (error) {
    console.error('Error saving game score:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '保存分数失败',
    };
  }
};

/**
 * 获取游戏排行榜
 * @param gameId 游戏ID
 * @param limit 限制数量
 * @returns 排行榜数据
 */
export const getGameLeaderboard = async (
  gameId: string,
  limit: number = 10
): Promise<{ success: boolean; data?: Array<any>; message?: string }> => {
  try {
    const response = await axios.get(`${API_URL}/games/${gameId}/leaderboard`, {
      params: { limit },
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching game leaderboard:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取排行榜失败',
    };
  }
};

/**
 * 获取游戏统计数据
 * @param gameId 游戏ID
 * @returns 游戏统计数据
 */
export const getGameStats = async (
  gameId: string
): Promise<{ success: boolean; data?: GameStats; message?: string }> => {
  try {
    const response = await axios.get(`${API_URL}/games/${gameId}/stats`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching game stats:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取游戏统计失败',
    };
  }
};

/**
 * 获取用户游戏历史
 * @param userId 用户ID
 * @param gameId 游戏ID（可选）
 * @returns 用户游戏历史
 */
export const getUserGameHistory = async (
  userId: string,
  gameId?: string
): Promise<{ success: boolean; data?: Array<GameScore>; message?: string }> => {
  try {
    const response = await axios.get(`${API_URL}/users/${userId}/games`, {
      params: { gameId },
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching user game history:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取游戏历史失败',
    };
  }
}; 