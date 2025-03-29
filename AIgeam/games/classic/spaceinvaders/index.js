import { GameAnalytics, Leaderboard, SoundManager } from '../../common/utils/index.js';

// 对象池类
class ObjectPool {
    constructor(createFn, maxSize = 100) {
        this.createFn = createFn;
        this.maxSize = maxSize;
        this.objects = [];
        this.activeObjects = new Set();
    }
    
    get() {
        let obj;
        if (this.objects.length > 0) {
            obj = this.objects.pop();
        } else if (this.activeObjects.size < this.maxSize) {
            obj = this.createFn();
        } else {
            return null;
        }
        this.activeObjects.add(obj);
        return obj;
    }
    
    release(obj) {
        if (this.activeObjects.has(obj)) {
            this.activeObjects.delete(obj);
            this.objects.push(obj);
        }
    }
    
    clear() {
        this.objects = [];
        this.activeObjects.clear();
    }
}

class SpaceInvaders {
    constructor() {
        this.analytics = new GameAnalytics();
        this.leaderboard = new Leaderboard('spaceinvaders');
        this.soundManager = new SoundManager();
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.score = 0;
        this.lives = 3;
        this.wave = 1;
        this.isGameOver = false;
        this.isPaused = false;
        
        // 加载最高分
        this.highScore = parseInt(localStorage.getItem('spaceinvaders_highscore')) || 0;
        document.getElementById('highScore').textContent = this.highScore;
        
        // 玩家飞船
        this.player = {
            width: 50,
            height: 30,
            x: 0,
            y: 0,
            speed: 5,
            dx: 0,
            bullets: [],
            lastShot: 0,
            shootDelay: 250
        };
        
        // 敌人配置
        this.enemyRows = 5;
        this.enemyCols = 11;
        this.enemies = [];
        this.enemyDirection = 1;
        this.enemyStepDown = 30;
        this.enemyMoveTimer = 0;
        this.enemyMoveInterval = 1000;
        this.enemyBullets = [];
        this.enemyShootTimer = 0;
        this.enemyShootInterval = 1000;
        
        // 护盾配置
        this.shields = [];
        this.shieldCount = 4;
        
        // 粒子效果
        this.particles = [];
        
        // 星空背景
        this.stars = [];
        this.initStars();
        
        this.initializeAudio();
        this.initializeGame();
        this.bindEvents();
        this.resize();
        
        // 开始游戏循环
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
        
        // 添加对象池
        this.bulletPool = new ObjectPool(() => ({
            x: 0,
            y: 0,
            width: 4,
            height: 15,
            speed: 0,
            isEnemy: false
        }), 50);
        
        this.particlePool = new ObjectPool(() => ({
            x: 0,
            y: 0,
            dx: 0,
            dy: 0,
            size: 0,
            color: '',
            life: 1,
            decay: 0
        }), 200);
        
        // 添加新特性
        this.powerUps = [];
        this.powerUpTypes = {
            rapidFire: { emoji: '⚡', color: '#ffd700', duration: 5000 },
            shield: { emoji: '🛡️', color: '#00ff00', duration: 8000 },
            multiShot: { emoji: '🎯', color: '#ff4757', duration: 6000 }
        };
        this.activePowerUps = new Set();
        
        // 添加成就系统
        this.achievements = {
            firstWave: { name: '初次胜利', description: '完成第一波敌人', unlocked: false },
            sharpshooter: { name: '神射手', description: '连续击中5个敌人', unlocked: false },
            survivor: { name: '生存专家', description: '达到第5波', unlocked: false },
            destroyer: { name: '毁灭者', description: '消灭100个敌人', unlocked: false }
        };
        this.killCount = 0;
        this.consecutiveHits = 0;
        
        // 添加特效
        this.screenShake = { intensity: 0, duration: 0 };
        
        // 添加难度系统
        this.difficulty = 1;
        this.difficultyIncrease = 0.1;
        
        // 添加连击系统
        this.combo = 0;
        this.comboTimer = 0;
        this.comboTimeout = 2000;
    }
    
    async initializeAudio() {
        await Promise.all([
            this.soundManager.loadSound('shoot', 'assets/shoot.wav'),
            this.soundManager.loadSound('explosion', 'assets/explosion.wav'),
            this.soundManager.loadSound('hit', 'assets/hit.wav'),
            this.soundManager.loadSound('playerHit', 'assets/playerHit.wav'),
            this.soundManager.loadSound('wave', 'assets/wave.wav')
        ]);
    }
    
    initStars() {
        const starCount = 100;
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 2 + 1
            });
        }
    }
    
    initializeGame() {
        this.initializeEnemies();
        this.initializeShields();
        this.updateWaveInfo();
    }
    
    initializeEnemies() {
        this.enemies = [];
        const types = ['🛸', '👾', '👽'];
        const points = [30, 20, 10];
        
        for (let row = 0; row < this.enemyRows; row++) {
            for (let col = 0; col < this.enemyCols; col++) {
                const type = Math.floor(row / 2);
                this.enemies.push({
                    x: col * 60,
                    y: row * 50 + 50,
                    width: 40,
                    height: 40,
                    type: types[type],
                    points: points[type],
                    isAlive: true
                });
            }
        }
        
        // 增加难度
        this.enemyMoveInterval = Math.max(200, 1000 - (this.wave - 1) * 100);
    }
    
    initializeShields() {
        this.shields = [];
        const shieldWidth = 80;
        const gap = (this.canvas.width - this.shieldCount * shieldWidth) / (this.shieldCount + 1);
        
        for (let i = 0; i < this.shieldCount; i++) {
            const shield = {
                x: gap + i * (shieldWidth + gap),
                y: this.canvas.height - 150,
                width: shieldWidth,
                height: 60,
                segments: []
            };
            
            // 创建护盾段
            const segmentSize = 10;
            for (let row = 0; row < shield.height / segmentSize; row++) {
                for (let col = 0; col < shield.width / segmentSize; col++) {
                    shield.segments.push({
                        x: shield.x + col * segmentSize,
                        y: shield.y + row * segmentSize,
                        size: segmentSize,
                        health: 3
                    });
                }
            }
            
            this.shields.push(shield);
        }
    }
    
    updateWaveInfo() {
        const waveInfo = document.getElementById('waveInfo');
        waveInfo.textContent = `第 ${this.wave} 波`;
        waveInfo.style.opacity = '1';
        
        setTimeout(() => {
            waveInfo.style.opacity = '0';
        }, 2000);
        
        document.getElementById('wave').textContent = this.wave;
    }
    
    bindEvents() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.player.dx = -this.player.speed;
            if (e.key === 'ArrowRight') this.player.dx = this.player.speed;
            if (e.key === ' ') this.shoot();
            if (e.key === 'p') this.togglePause();
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' && this.player.dx < 0) this.player.dx = 0;
            if (e.key === 'ArrowRight' && this.player.dx > 0) this.player.dx = 0;
        });
        
        // 触摸控制
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const shootBtn = document.getElementById('shootBtn');
        
        const handleTouch = (direction) => {
            let interval;
            const move = () => {
                this.player.dx = direction * this.player.speed;
            };
            
            return {
                start: (e) => {
                    e.preventDefault();
                    move();
                    interval = setInterval(move, 16);
                },
                end: () => {
                    this.player.dx = 0;
                    clearInterval(interval);
                }
            };
        };
        
        const leftTouch = handleTouch(-1);
        const rightTouch = handleTouch(1);
        
        leftBtn.addEventListener('touchstart', leftTouch.start);
        leftBtn.addEventListener('touchend', leftTouch.end);
        rightBtn.addEventListener('touchstart', rightTouch.start);
        rightBtn.addEventListener('touchend', rightTouch.end);
        
        shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.shoot();
        });
        
        // 窗口大小改变
        window.addEventListener('resize', this.resize.bind(this));
    }
    
    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        
        // 更新玩家位置
        this.player.y = this.canvas.height - this.player.height - 20;
        this.player.x = (this.canvas.width - this.player.width) / 2;
        
        // 重新初始化星空
        this.initStars();
    }
    
    shoot() {
        if (this.isGameOver || this.isPaused) return;
        
        const now = performance.now();
        if (now - this.player.lastShot >= this.player.shootDelay) {
            if (this.player.multiShot) {
                // 三发子弹
                const angles = [-15, 0, 15];
                angles.forEach(angle => {
                    const bullet = this.bulletPool.get();
                    if (bullet) {
                        const rad = angle * Math.PI / 180;
                        bullet.x = this.player.x + this.player.width / 2;
                        bullet.y = this.player.y;
                        bullet.speed = 10;
                        bullet.dx = Math.sin(rad) * bullet.speed;
                        bullet.dy = -Math.cos(rad) * bullet.speed;
                        bullet.isEnemy = false;
                    }
                });
            } else {
                const bullet = this.bulletPool.get();
                if (bullet) {
                    bullet.x = this.player.x + this.player.width / 2;
                    bullet.y = this.player.y;
                    bullet.speed = 10;
                    bullet.dx = 0;
                    bullet.dy = -bullet.speed;
                    bullet.isEnemy = false;
                }
            }
            
            this.soundManager.play('shoot');
            this.player.lastShot = now;
        }
    }
    
    enemyShoot() {
        const now = performance.now();
        if (now - this.enemyShootTimer >= this.enemyShootInterval) {
            const livingEnemies = this.enemies.filter(enemy => enemy.isAlive);
            if (livingEnemies.length > 0) {
                const shooter = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
                this.enemyBullets.push({
                    x: shooter.x + shooter.width / 2,
                    y: shooter.y + shooter.height,
                    width: 4,
                    height: 15,
                    speed: 5
                });
            }
            this.enemyShootTimer = now;
        }
    }
    
    moveEnemies() {
        const now = performance.now();
        if (now - this.enemyMoveTimer >= this.enemyMoveInterval) {
            let touchedEdge = false;
            
            // 检查是否触碰边界
            this.enemies.forEach(enemy => {
                if (!enemy.isAlive) return;
                
                if (this.enemyDirection > 0 && enemy.x + enemy.width >= this.canvas.width - 20) {
                    touchedEdge = true;
                } else if (this.enemyDirection < 0 && enemy.x <= 20) {
                    touchedEdge = true;
                }
            });
            
            // 更新敌人位置
            this.enemies.forEach(enemy => {
                if (!enemy.isAlive) return;
                
                if (touchedEdge) {
                    enemy.y += this.enemyStepDown;
                } else {
                    enemy.x += this.enemyDirection * 20;
                }
            });
            
            if (touchedEdge) {
                this.enemyDirection *= -1;
            }
            
            this.enemyMoveTimer = now;
        }
    }
    
    createExplosion(x, y, color) {
        for (let i = 0; i < 15; i++) {
            const angle = (Math.PI * 2 / 15) * i;
            const speed = Math.random() * 3 + 2;
            
            const particle = this.particlePool.get();
            if (particle) {
                particle.x = x;
                particle.y = y;
                particle.dx = Math.cos(angle) * speed;
                particle.dy = Math.sin(angle) * speed;
                particle.size = Math.random() * 3 + 2;
                particle.color = color;
                particle.life = 1;
                particle.decay = Math.random() * 0.02 + 0.02;
            }
        }
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.x += particle.dx;
            particle.y += particle.dy;
            particle.life -= particle.decay;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updateStars() {
        for (const star of this.stars) {
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        }
    }
    
    checkCollisions() {
        // 玩家子弹与敌人碰撞
        for (let i = this.player.bullets.length - 1; i >= 0; i--) {
            const bullet = this.player.bullets[i];
            
            // 检查与敌人碰撞
            for (const enemy of this.enemies) {
                if (!enemy.isAlive) continue;
                
                if (this.checkCollision(bullet, enemy)) {
                    enemy.isAlive = false;
                    this.score += enemy.points;
                    document.getElementById('score').textContent = this.score;
                    this.player.bullets.splice(i, 1);
                    this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff7675');
                    this.soundManager.play('explosion');
                    
                    // 检查是否清空当前波次
                    if (this.enemies.every(e => !e.isAlive)) {
                        this.nextWave();
                    }
                    break;
                }
            }
            
            // 检查与护盾碰撞
            if (bullet) {
                for (const shield of this.shields) {
                    for (let j = shield.segments.length - 1; j >= 0; j--) {
                        const segment = shield.segments[j];
                        if (this.checkCollision(bullet, segment)) {
                            segment.health--;
                            if (segment.health <= 0) {
                                shield.segments.splice(j, 1);
                            }
                            this.player.bullets.splice(i, 1);
                            this.soundManager.play('hit');
                            break;
                        }
                    }
                }
            }
        }
        
        // 敌人子弹与玩家和护盾碰撞
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            
            // 检查与玩家碰撞
            if (this.checkCollision(bullet, this.player)) {
                this.enemyBullets.splice(i, 1);
                this.lives--;
                document.getElementById('lives').textContent = this.lives;
                this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#55efc4');
                this.soundManager.play('playerHit');
                
                if (this.lives <= 0) {
                    this.gameOver();
                }
                continue;
            }
            
            // 检查与护盾碰撞
            for (const shield of this.shields) {
                for (let j = shield.segments.length - 1; j >= 0; j--) {
                    const segment = shield.segments[j];
                    if (this.checkCollision(bullet, segment)) {
                        segment.health--;
                        if (segment.health <= 0) {
                            shield.segments.splice(j, 1);
                        }
                        this.enemyBullets.splice(i, 1);
                        this.soundManager.play('hit');
                        break;
                    }
                }
            }
        }
        
        // 检查敌人是否到达底部
        for (const enemy of this.enemies) {
            if (enemy.isAlive && enemy.y + enemy.height >= this.player.y) {
                this.gameOver();
                break;
            }
        }
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    nextWave() {
        this.wave++;
        this.updateWaveInfo();
        this.soundManager.play('wave');
        this.enemyBullets = [];
        this.player.bullets = [];
        this.initializeEnemies();
    }
    
    update(deltaTime) {
        if (this.isPaused || this.isGameOver) return;
        
        this.updateCombo(deltaTime);
        this.updatePowerUps();
        this.updateScreenShake(deltaTime);
        this.checkAchievements();
        
        // 更新玩家位置
        this.player.x += this.player.dx;
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x + this.player.width > this.canvas.width) {
            this.player.x = this.canvas.width - this.player.width;
        }
        
        // 更新玩家子弹
        for (let i = this.player.bullets.length - 1; i >= 0; i--) {
            const bullet = this.player.bullets[i];
            bullet.y -= bullet.speed;
            if (bullet.y + bullet.height < 0) {
                this.player.bullets.splice(i, 1);
            }
        }
        
        // 更新敌人子弹
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            bullet.y += bullet.speed;
            if (bullet.y > this.canvas.height) {
                this.enemyBullets.splice(i, 1);
            }
        }
        
        this.moveEnemies();
        this.enemyShoot();
        this.checkCollisions();
        this.updateParticles();
        this.updateStars();
        
        // 随机生成道具
        if (Math.random() < 0.001) {
            const livingEnemies = this.enemies.filter(e => e.isAlive);
            if (livingEnemies.length > 0) {
                const enemy = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
                this.createPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height);
            }
        }
    }
    
    draw() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制星空背景
        this.ctx.fillStyle = '#ffffff';
        for (const star of this.stars) {
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // 绘制护盾
        this.ctx.fillStyle = '#a8e6cf';
        for (const shield of this.shields) {
            for (const segment of shield.segments) {
                this.ctx.globalAlpha = segment.health / 3;
                this.ctx.fillRect(segment.x, segment.y, segment.size, segment.size);
            }
        }
        this.ctx.globalAlpha = 1;
        
        // 绘制敌人
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        for (const enemy of this.enemies) {
            if (enemy.isAlive) {
                this.ctx.fillText(enemy.type, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            }
        }
        
        // 绘制玩家
        this.ctx.fillStyle = '#55efc4';
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.x + this.player.width / 2, this.player.y);
        this.ctx.lineTo(this.player.x + this.player.width, this.player.y + this.player.height);
        this.ctx.lineTo(this.player.x, this.player.y + this.player.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 绘制子弹
        this.ctx.fillStyle = '#74b9ff';
        for (const bullet of this.player.bullets) {
            this.ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
        }
        
        this.ctx.fillStyle = '#ff7675';
        for (const bullet of this.enemyBullets) {
            this.ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
        }
        
        // 绘制粒子
        for (const particle of this.particles) {
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        
        // 绘制道具
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        for (const powerUp of this.powerUps) {
            this.ctx.fillStyle = powerUp.color;
            this.ctx.fillText(powerUp.emoji, powerUp.x, powerUp.y);
        }
        
        // 绘制连击数
        if (this.combo > 1) {
            this.ctx.font = '24px Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${this.combo}连击!`, this.canvas.width / 2, 50);
        }
        
        // 绘制护盾效果
        if (this.player.isShielded) {
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                this.player.width * 0.8,
                0,
                Math.PI * 2
            );
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
    }
    
    gameOver() {
        this.isGameOver = true;
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('spaceinvaders_highscore', this.score);
            document.getElementById('highScore').textContent = this.score;
        }
        
        // 显示游戏结束界面
        document.getElementById('gameOverTitle').textContent = '游戏结束';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'block';
        
        // 记录游戏数据
        this.analytics.logEvent('gameOver', {
            score: this.score,
            wave: this.wave,
            lives: this.lives,
            highScore: this.highScore
        });
        
        // 记录成绩
        this.leaderboard.addScore(this.score, 'Player');
    }
    
    createPowerUp(x, y) {
        const types = Object.keys(this.powerUpTypes);
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.powerUps.push({
            x,
            y,
            type,
            width: 30,
            height: 30,
            speed: 2,
            ...this.powerUpTypes[type]
        });
    }
    
    updatePowerUps() {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.y += powerUp.speed;
            
            if (this.checkCollision(powerUp, this.player)) {
                this.activatePowerUp(powerUp.type);
                this.powerUps.splice(i, 1);
                this.soundManager.play('powerup');
            } else if (powerUp.y > this.canvas.height) {
                this.powerUps.splice(i, 1);
            }
        }
    }
    
    activatePowerUp(type) {
        const powerUp = this.powerUpTypes[type];
        this.activePowerUps.add(type);
        
        switch (type) {
            case 'rapidFire':
                this.player.shootDelay /= 2;
                break;
            case 'shield':
                this.player.isShielded = true;
                break;
            case 'multiShot':
                this.player.multiShot = true;
                break;
        }
        
        setTimeout(() => {
            this.deactivatePowerUp(type);
        }, powerUp.duration);
    }
    
    deactivatePowerUp(type) {
        this.activePowerUps.delete(type);
        
        switch (type) {
            case 'rapidFire':
                this.player.shootDelay *= 2;
                break;
            case 'shield':
                this.player.isShielded = false;
                break;
            case 'multiShot':
                this.player.multiShot = false;
                break;
        }
    }
    
    updateCombo(deltaTime) {
        if (this.combo > 0) {
            this.comboTimer += deltaTime;
            if (this.comboTimer >= this.comboTimeout) {
                this.combo = 0;
                this.comboTimer = 0;
            }
        }
    }
    
    addScreenShake(intensity = 10, duration = 200) {
        this.screenShake = { intensity, duration };
    }
    
    updateScreenShake(deltaTime) {
        if (this.screenShake.duration > 0) {
            const shake = {
                x: (Math.random() - 0.5) * this.screenShake.intensity,
                y: (Math.random() - 0.5) * this.screenShake.intensity
            };
            this.ctx.translate(shake.x, shake.y);
            this.screenShake.duration -= deltaTime;
        }
    }
    
    checkAchievements() {
        const { achievements } = this;
        
        if (!achievements.firstWave.unlocked && this.wave > 1) {
            this.unlockAchievement('firstWave');
        }
        
        if (!achievements.survivor.unlocked && this.wave >= 5) {
            this.unlockAchievement('survivor');
        }
        
        if (!achievements.destroyer.unlocked && this.killCount >= 100) {
            this.unlockAchievement('destroyer');
        }
        
        if (!achievements.sharpshooter.unlocked && this.consecutiveHits >= 5) {
            this.unlockAchievement('sharpshooter');
        }
    }
    
    unlockAchievement(id) {
        if (!this.achievements[id].unlocked) {
            this.achievements[id].unlocked = true;
            this.showAchievementNotification(this.achievements[id]);
            this.analytics.logEvent('achievement', { id });
        }
    }
    
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <h3>🏆 成就解锁</h3>
            <p>${achievement.name}</p>
            <p>${achievement.description}</p>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}

// 重启游戏
window.restartGame = function() {
    location.reload();
};

// 启动游戏
new SpaceInvaders();

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
    .achievement-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        padding: 15px;
        border-radius: 10px;
        z-index: 1000;
        transition: opacity 0.5s;
    }
    
    .achievement-notification h3 {
        color: #ffd700;
        margin: 0 0 10px 0;
    }
    
    .achievement-notification p {
        margin: 5px 0;
    }
`;
document.head.appendChild(style); 