import express from 'express';
import { auth, adminAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Logger } from '../utils/logger';

const router = express.Router();

// 获取当前用户信息
router.get('/me', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // 返回用户信息（不包含密码）
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      gameStats: {
        gamesPlayed: user.gameStats.gamesPlayed,
        wins: user.gameStats.wins,
        losses: user.gameStats.losses,
        highScores: Object.fromEntries(user.gameStats.highScores)
      }
    };
    
    res.status(200).json(userResponse);
  } catch (error) {
    Logger.error('Error getting current user', error as Error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户资料
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // 检查用户是否有权限更新
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限更新此用户资料' });
    }
    
    // 不允许更新某些字段
    const allowedUpdates = ['username', 'avatar', 'email'];
    const updateData = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '没有提供有效的更新字段' });
    }
    
    // 更新用户资料
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 返回更新后的用户信息（不包含密码）
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      gameStats: {
        gamesPlayed: user.gameStats.gamesPlayed,
        wins: user.gameStats.wins,
        losses: user.gameStats.losses,
        highScores: Object.fromEntries(user.gameStats.highScores)
      }
    };
    
    Logger.info('User profile updated', { userId: user._id, username: user.username });
    
    res.status(200).json(userResponse);
  } catch (error) {
    Logger.error('Error updating user profile', error as Error);
    res.status(500).json({ error: '更新用户资料失败' });
  }
});

// 更改密码
router.post('/:id/change-password', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    // 检查用户是否有权限更改密码
    if (req.user._id.toString() !== id) {
      return res.status(403).json({ error: '无权限更改此用户密码' });
    }
    
    // 检查当前密码是否正确
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: '当前密码不正确' });
    }
    
    // 更新密码
    user.password = newPassword;
    await user.save();
    
    Logger.info('User password changed', { userId: user._id, username: user.username });
    
    res.status(200).json({ message: '密码更改成功' });
  } catch (error) {
    Logger.error('Error changing password', error as Error);
    res.status(500).json({ error: '密码更改失败' });
  }
});

// 管理员获取所有用户
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    // 格式化用户数据
    const userResponse = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      gameStats: {
        gamesPlayed: user.gameStats.gamesPlayed,
        wins: user.gameStats.wins,
        losses: user.gameStats.losses,
        highScores: Object.fromEntries(user.gameStats.highScores)
      },
      createdAt: user.createdAt
    }));
    
    res.status(200).json(userResponse);
  } catch (error) {
    Logger.error('Error getting all users', error as Error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

export default router;