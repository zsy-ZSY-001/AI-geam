import { GameAnalytics, Leaderboard, SoundManager } from '../../common/utils/index.js';

class Breakout {
    constructor() {
        this.analytics = new GameAnalytics();
        this.leaderboard = new Leaderboard('breakout');
        this.soundManager = new SoundManager();
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.score = 0;
        this.lives = 3;
        this.isGameOver = false;
        this.isPaused = false;
        
        // 加载最高分
        this.highScore = parseInt(localStorage.getItem('breakout_highscore')) || 0;
        document.getElementById('highScore').textContent = this.highScore;
        
        // 初始化游戏对象
        this.paddle = {
            width: 100,
            height: 15,
            x: 0,
            y: 0,
            speed: 8,
            dx: 0
        };
        
        this.ball = {
            radius: 8,
            x: 0,
            y: 0,
            dx: 5,
            dy: -5,
            speed: 5
        };
        
        // 砖块配置
        this.brickRowCount = 5;
        this.brickColumnCount = 9;
        this.brickWidth = 0;
        this.brickHeight = 20;
        this.brickPadding = 10;
        this.brickOffsetTop = 30;
        this.brickOffsetLeft = 30;
        this.bricks = [];
        
        this.initializeAudio();
        this.initializeBricks();
        this.bindEvents();
        this.resize();
        this.reset();
        
        // 开始游戏循环
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    async initializeAudio() {
        await Promise.all([
            this.soundManager.loadSound('hit', 'assets/hit.wav'),
            this.soundManager.loadSound('paddle', 'assets/paddle.wav'),
            this.soundManager.loadSound('wall', 'assets/wall.wav'),
            this.soundManager.loadSound('life', 'assets/life.wav'),
            this.soundManager.loadSound('win', 'assets/win.wav')
        ]);
    }
    
    initializeBricks() {
        const colors = ['#e17055', '#e84393', '#00cec9', '#6c5ce7', '#a8e6cf'];
        
        for (let row = 0; row < this.brickRowCount; row++) {
            this.bricks[row] = [];
            for (let col = 0; col < this.brickColumnCount; col++) {
                this.bricks[row][col] = {
                    x: 0,
                    y: 0,
                    status: 1,
                    color: colors[row]
                };
            }
        }
    }
    
    bindEvents() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.paddle.dx = -this.paddle.speed;
            if (e.key === 'ArrowRight') this.paddle.dx = this.paddle.speed;
            if (e.key === ' ') this.togglePause();
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' && this.paddle.dx < 0) this.paddle.dx = 0;
            if (e.key === 'ArrowRight' && this.paddle.dx > 0) this.paddle.dx = 0;
        });
        
        // 触摸控制
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        
        const handleTouch = (direction) => {
            let interval;
            const move = () => {
                this.paddle.dx = direction * this.paddle.speed;
            };
            
            return {
                start: (e) => {
                    e.preventDefault();
                    move();
                    interval = setInterval(move, 16);
                },
                end: () => {
                    this.paddle.dx = 0;
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
        
        // 窗口大小改变
        window.addEventListener('resize', this.resize.bind(this));
    }
    
    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        
        // 更新砖块尺寸
        this.brickWidth = (this.canvas.width - 2 * this.brickOffsetLeft - (this.brickColumnCount - 1) * this.brickPadding) / this.brickColumnCount;
        
        // 更新砖块位置
        for (let row = 0; row < this.brickRowCount; row++) {
            for (let col = 0; col < this.brickColumnCount; col++) {
                const brick = this.bricks[row][col];
                brick.x = col * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
                brick.y = row * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
            }
        }
        
        // 更新挡板和球的位置
        this.paddle.y = this.canvas.height - this.paddle.height - 10;
        this.reset();
    }
    
    reset() {
        this.paddle.x = (this.canvas.width - this.paddle.width) / 2;
        this.ball.x = this.canvas.width / 2;
        this.ball.y = this.paddle.y - this.ball.radius;
        this.ball.dx = this.ball.speed;
        this.ball.dy = -this.ball.speed;
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
    }
    
    update() {
        if (this.isPaused || this.isGameOver) return;
        
        // 更新挡板位置
        this.paddle.x += this.paddle.dx;
        
        // 限制挡板在画布范围内
        if (this.paddle.x < 0) this.paddle.x = 0;
        if (this.paddle.x + this.paddle.width > this.canvas.width) {
            this.paddle.x = this.canvas.width - this.paddle.width;
        }
        
        // 更新球的位置
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
        // 球碰撞检测 - 墙壁
        if (this.ball.x + this.ball.radius > this.canvas.width || this.ball.x - this.ball.radius < 0) {
            this.ball.dx = -this.ball.dx;
            this.soundManager.play('wall');
        }
        
        if (this.ball.y - this.ball.radius < 0) {
            this.ball.dy = -this.ball.dy;
            this.soundManager.play('wall');
        }
        
        // 球碰撞检测 - 底部
        if (this.ball.y + this.ball.radius > this.canvas.height) {
            this.lives--;
            document.getElementById('lives').textContent = this.lives;
            this.soundManager.play('life');
            
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.reset();
            }
        }
        
        // 球碰撞检测 - 挡板
        if (this.ball.y + this.ball.radius > this.paddle.y &&
            this.ball.x > this.paddle.x &&
            this.ball.x < this.paddle.x + this.paddle.width) {
            this.ball.dy = -this.ball.dy;
            this.soundManager.play('paddle');
            
            // 根据击中挡板的位置改变球的水平速度
            const hitPoint = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            this.ball.dx = hitPoint * this.ball.speed;
        }
        
        // 球碰撞检测 - 砖块
        for (let row = 0; row < this.brickRowCount; row++) {
            for (let col = 0; col < this.brickColumnCount; col++) {
                const brick = this.bricks[row][col];
                
                if (brick.status === 1) {
                    if (this.ball.x > brick.x &&
                        this.ball.x < brick.x + this.brickWidth &&
                        this.ball.y > brick.y &&
                        this.ball.y < brick.y + this.brickHeight) {
                        this.ball.dy = -this.ball.dy;
                        brick.status = 0;
                        this.score += 10;
                        document.getElementById('score').textContent = this.score;
                        this.soundManager.play('hit');
                        
                        // 检查是否获胜
                        if (this.score === this.brickRowCount * this.brickColumnCount * 10) {
                            this.win();
                        }
                    }
                }
            }
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制砖块
        for (let row = 0; row < this.brickRowCount; row++) {
            for (let col = 0; col < this.brickColumnCount; col++) {
                const brick = this.bricks[row][col];
                
                if (brick.status === 1) {
                    this.ctx.beginPath();
                    this.ctx.rect(brick.x, brick.y, this.brickWidth, this.brickHeight);
                    this.ctx.fillStyle = brick.color;
                    this.ctx.fill();
                    this.ctx.closePath();
                }
            }
        }
        
        // 绘制挡板
        this.ctx.beginPath();
        this.ctx.rect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        this.ctx.fillStyle = '#fdcb6e';
        this.ctx.fill();
        this.ctx.closePath();
        
        // 绘制球
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ff7675';
        this.ctx.fill();
        this.ctx.closePath();
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    gameOver() {
        this.isGameOver = true;
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('breakout_highscore', this.score);
            document.getElementById('highScore').textContent = this.score;
        }
        
        // 显示游戏结束界面
        document.getElementById('gameOverTitle').textContent = '游戏结束';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'block';
        
        // 记录游戏数据
        this.analytics.logEvent('gameOver', {
            score: this.score,
            lives: this.lives,
            highScore: this.highScore
        });
        
        // 记录成绩
        this.leaderboard.addScore(this.score, 'Player');
    }
    
    win() {
        this.isGameOver = true;
        this.soundManager.play('win');
        
        // 更新最高分
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('breakout_highscore', this.score);
            document.getElementById('highScore').textContent = this.score;
        }
        
        // 显示胜利界面
        document.getElementById('gameOverTitle').textContent = '恭喜胜利！';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'block';
        
        // 记录游戏数据
        this.analytics.logEvent('win', {
            score: this.score,
            lives: this.lives,
            highScore: this.highScore
        });
        
        // 记录成绩
        this.leaderboard.addScore(this.score, 'Player');
    }
}

// 重启游戏
window.restartGame = function() {
    location.reload();
};

// 启动游戏
new Breakout(); 