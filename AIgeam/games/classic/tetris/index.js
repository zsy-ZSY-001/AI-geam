import { GameAnalytics, Leaderboard, SoundManager } from '../../common/utils/index.js';

// 游戏配置
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const COLORS = [
    '#FF0D72',
    '#0DC2FF',
    '#0DFF72',
    '#F538FF',
    '#FF8E0D',
    '#FFE138',
    '#3877FF'
];

// 方块形状定义
const SHAPES = [
    [[1, 1, 1, 1]],                         // I
    [[1, 1], [1, 1]],                       // O
    [[1, 1, 1], [0, 1, 0]],                // T
    [[1, 1, 1], [1, 0, 0]],                // L
    [[1, 1, 1], [0, 0, 1]],                // J
    [[1, 1, 0], [0, 1, 1]],                // S
    [[0, 1, 1], [1, 1, 0]]                 // Z
];

class Tetris {
    constructor() {
        this.analytics = new GameAnalytics();
        this.leaderboard = new Leaderboard('tetris');
        this.soundManager = new SoundManager();
        this.initializeAudio();
        
        this.canvas = document.getElementById('game-board');
        this.nextCanvas = document.getElementById('next-piece-display');
        this.scoreElement = document.getElementById('score');
        this.levelElement = document.getElementById('level');
        this.linesElement = document.getElementById('lines');
        this.gameOverElement = document.getElementById('game-over');
        this.finalScoreElement = document.getElementById('final-score');
        
        this.board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.isPaused = false;
        
        this.currentPiece = this.newPiece();
        this.nextPiece = this.newPiece();
        
        this.initializeBoard();
        this.initializeNextPiece();
        this.bindControls();
        
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;
        this.animate();
    }
    
    async initializeAudio() {
        await Promise.all([
            this.soundManager.loadSound('move', 'assets/move.wav'),
            this.soundManager.loadSound('rotate', 'assets/rotate.wav'),
            this.soundManager.loadSound('drop', 'assets/drop.wav'),
            this.soundManager.loadSound('clear', 'assets/clear.wav'),
            this.soundManager.loadSound('gameover', 'assets/gameover.wav')
        ]);
    }
    
    initializeBoard() {
        // 创建游戏板网格
        for (let i = 0; i < BOARD_HEIGHT * BOARD_WIDTH; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            this.canvas.appendChild(cell);
        }
    }
    
    initializeNextPiece() {
        // 创建预览区域
        const size = 4;
        for (let i = 0; i < size * size; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.width = '20px';
            cell.style.height = '20px';
            this.nextCanvas.appendChild(cell);
        }
        this.nextCanvas.style.display = 'grid';
        this.nextCanvas.style.gridTemplateColumns = `repeat(${size}, 20px)`;
        this.nextCanvas.style.gap = '1px';
    }
    
    bindControls() {
        document.addEventListener('keydown', (event) => {
            if (this.gameOver) return;
            
            switch (event.key) {
                case 'ArrowLeft':
                    this.moveLeft();
                    break;
                case 'ArrowRight':
                    this.moveRight();
                    break;
                case 'ArrowDown':
                    this.moveDown();
                    break;
                case 'ArrowUp':
                    this.rotate();
                    break;
                case ' ':
                    this.hardDrop();
                    break;
                case 'p':
                case 'P':
                    this.togglePause();
                    break;
            }
        });
    }
    
    newPiece() {
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        return {
            shape,
            color,
            x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2),
            y: 0
        };
    }
    
    moveLeft() {
        this.currentPiece.x--;
        if (this.collision()) {
            this.currentPiece.x++;
        } else {
            this.soundManager.play('move');
            this.draw();
        }
    }
    
    moveRight() {
        this.currentPiece.x++;
        if (this.collision()) {
            this.currentPiece.x--;
        } else {
            this.soundManager.play('move');
            this.draw();
        }
    }
    
    moveDown() {
        this.currentPiece.y++;
        if (this.collision()) {
            this.currentPiece.y--;
            this.merge();
            this.currentPiece = this.nextPiece;
            this.nextPiece = this.newPiece();
            if (this.collision()) {
                this.gameOver = true;
                this.soundManager.play('gameover');
                this.showGameOver();
            }
        } else {
            this.draw();
        }
    }
    
    hardDrop() {
        while (!this.collision()) {
            this.currentPiece.y++;
        }
        this.currentPiece.y--;
        this.soundManager.play('drop');
        this.moveDown();
    }
    
    rotate() {
        const matrix = this.currentPiece.shape;
        const N = matrix.length;
        const rotated = Array(N).fill().map(() => Array(N).fill(0));
        
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                rotated[x][N - 1 - y] = matrix[y][x];
            }
        }
        
        const previousShape = this.currentPiece.shape;
        this.currentPiece.shape = rotated;
        
        if (this.collision()) {
            this.currentPiece.shape = previousShape;
        } else {
            this.soundManager.play('rotate');
            this.draw();
        }
    }
    
    collision() {
        const shape = this.currentPiece.shape;
        const pos = {x: this.currentPiece.x, y: this.currentPiece.y};
        
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] !== 0 &&
                    (this.board[pos.y + y] === undefined ||
                     this.board[pos.y + y][pos.x + x] === undefined ||
                     this.board[pos.y + y][pos.x + x] !== 0)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    merge() {
        const shape = this.currentPiece.shape;
        const pos = {x: this.currentPiece.x, y: this.currentPiece.y};
        
        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.board[pos.y + y][pos.x + x] = this.currentPiece.color;
                }
            });
        });
        
        this.clearLines();
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let y = this.board.length - 1; y >= 0; y--) {
            if (this.board[y].every(value => value !== 0)) {
                const row = this.board.splice(y, 1)[0].fill(0);
                this.board.unshift(row);
                y++;
                linesCleared++;
            }
        }
        
        if (linesCleared > 0) {
            this.soundManager.play('clear');
            this.lines += linesCleared;
            this.score += this.calculateScore(linesCleared);
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            
            this.scoreElement.textContent = this.score;
            this.levelElement.textContent = this.level;
            this.linesElement.textContent = this.lines;
        }
    }
    
    calculateScore(linesCleared) {
        const basePoints = [40, 100, 300, 1200];
        return basePoints[linesCleared - 1] * this.level;
    }
    
    draw() {
        // 清空画布
        const cells = this.canvas.children;
        this.board.forEach((row, y) => {
            row.forEach((value, x) => {
                cells[y * BOARD_WIDTH + x].style.backgroundColor = value || '#000';
            });
        });
        
        // 绘制当前方块
        this.currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const pos = (this.currentPiece.y + y) * BOARD_WIDTH + (this.currentPiece.x + x);
                    if (cells[pos]) {
                        cells[pos].style.backgroundColor = this.currentPiece.color;
                    }
                }
            });
        });
        
        // 绘制下一个方块
        const nextCells = this.nextCanvas.children;
        Array.from(nextCells).forEach(cell => cell.style.backgroundColor = '#000');
        
        this.nextPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const pos = y * 4 + x;
                    if (nextCells[pos]) {
                        nextCells[pos].style.backgroundColor = this.nextPiece.color;
                    }
                }
            });
        });
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.lastTime = performance.now();
            this.animate();
        }
    }
    
    showGameOver() {
        this.gameOverElement.style.display = 'block';
        this.finalScoreElement.textContent = this.score;
        this.leaderboard.addScore(this.score, 'Player');
        this.analytics.logEvent('gameOver', { score: this.score, level: this.level, lines: this.lines });
    }
    
    animate(time = 0) {
        if (this.gameOver || this.isPaused) return;
        
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.moveDown();
            this.dropCounter = 0;
        }
        
        this.draw();
        requestAnimationFrame(this.animate.bind(this));
    }
}

// 重启游戏
window.restartGame = function() {
    location.reload();
};

// 启动游戏
new Tetris(); 