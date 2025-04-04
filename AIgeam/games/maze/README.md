# 像素迷宫·无限版

一个具有无限探索可能的多人在线迷宫游戏。

## 游戏特色

1. **无限地图生成**
   - 程序化地形生成
   - 多样化地形类型
   - 动态难度调整
   - 独特的迷宫算法

2. **多人在线功能**
   - 实时多人探索
   - 团队合作模式
   - PVP对战模式
   - 全球排行榜

3. **角色系统**
   - 多种角色选择
   - 技能树系统
   - 装备收集
   - 角色升级

4. **探索要素**
   - 隐藏宝藏
   - 特殊事件
   - 随机任务
   - 成就系统

## 游戏模式

1. **单人模式**
   - 探索冒险：自由探索无限迷宫
   - 闯关模式：固定关卡挑战
   - 生存模式：资源有限的生存挑战
   - 速通模式：竞速通关

2. **多人模式**
   - 合作探索：多人共同探索
   - 竞速比赛：多人竞速通关
   - 团队对抗：团队PVP模式
   - 大逃杀：多人生存对抗

## 操作说明

- WASD：移动
- 空格：跳跃
- 鼠标左键：使用主要技能
- 鼠标右键：使用次要技能
- E键：互动/拾取
- Q键：使用道具
- Tab键：打开地图

## 技术特点

1. **客户端**
   - WebGL渲染
   - 物理引擎
   - 粒子系统
   - 动态光影

2. **服务器**
   - 实时同步
   - 状态预测
   - 负载均衡
   - 反作弊系统

## 系统要求

### 客户端
- 现代浏览器（支持WebGL 2.0）
- 4GB以上内存
- 稳定的网络连接
- 推荐使用独立显卡

### 服务器
- Node.js 14+
- Redis
- MongoDB
- WebSocket支持

## 开发说明

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 服务器部署
```bash
# 启动服务器
npm run server

# PM2部署
pm2 start ecosystem.config.js
``` 