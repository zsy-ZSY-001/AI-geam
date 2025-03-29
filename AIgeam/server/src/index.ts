import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import promBundle from 'express-prom-bundle';

// 路由导入
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import gameRoutes from './routes/gameRoutes';

// 工具导入
import { Logger } from './utils/logger';

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// 连接MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aigeam')
  .then(() => {
    Logger.info('Connected to MongoDB');
  })
  .catch((err) => {
    Logger.error('MongoDB connection error', err);
    process.exit(1);
  });

// Prometheus监控
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  promClient: {
    collectDefaultMetrics: {}
  }
});

// 中间件
app.use(metricsMiddleware);
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => Logger.http(message.trim())
    }
  }));
}

// 限流
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求次数过多，请稍后再试' }
});

// 应用路由
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/games', apiLimiter, gameRoutes);

// 静态文件服务
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}

// 捕获未处理的错误
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  Logger.error('Unhandled error', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 处理404
app.use((req, res) => {
  res.status(404).json({ error: '未找到请求的资源' });
});

// WebSocket连接处理
io.on('connection', (socket) => {
  Logger.info('User connected to socket', { socketId: socket.id });
  
  socket.on('join-game', (gameId: string) => {
    socket.join(gameId);
    Logger.info('User joined game room', { socketId: socket.id, gameId });
  });
  
  socket.on('leave-game', (gameId: string) => {
    socket.leave(gameId);
    Logger.info('User left game room', { socketId: socket.id, gameId });
  });
  
  socket.on('game-update', (data: { gameId: string, [key: string]: any }) => {
    socket.to(data.gameId).emit('game-update', data);
  });
  
  socket.on('disconnect', () => {
    Logger.info('User disconnected from socket', { socketId: socket.id });
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  Logger.info(`Server running on port ${PORT}`);
}); 