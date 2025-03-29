import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Logger } from '../utils/logger';

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        error: '用户已存在',
        field: existingUser.email === email ? 'email' : 'username'
      });
    }

    // 创建新用户
    const newUser = new User({
      username,
      email,
      password, // 密码会在User模型的pre save钩子中自动加密
      gameStats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        highScores: new Map()
      }
    });

    await newUser.save();

    // 生成JWT
    const token = jwt.sign(
      { _id: newUser._id },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 返回用户信息和令牌（不包含密码）
    const userResponse = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      avatar: newUser.avatar,
      gameStats: {
        gamesPlayed: newUser.gameStats.gamesPlayed,
        wins: newUser.gameStats.wins,
        losses: newUser.gameStats.losses,
        highScores: Object.fromEntries(newUser.gameStats.highScores)
      }
    };

    Logger.info('User registered', { userId: newUser._id, username: newUser.username });
    
    res.status(201).json({ user: userResponse, token });
  } catch (error) {
    Logger.error('Registration error', error as Error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码不正确' });
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: '邮箱或密码不正确' });
    }

    // 生成JWT
    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 返回用户信息和令牌（不包含密码）
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      gameStats: {
        gamesPlayed: user.gameStats.gamesPlayed,
        wins: user.gameStats.wins,
        losses: user.gameStats.losses,
        highScores: Object.fromEntries(user.gameStats.highScores)
      }
    };

    Logger.info('User logged in', { userId: user._id, username: user.username });
    
    res.status(200).json({ user: userResponse, token });
  } catch (error) {
    Logger.error('Login error', error as Error);
    res.status(500).json({ error: '登录失败' });
  }
});

export default router; 