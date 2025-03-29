import { GameAnalytics, Leaderboard, SoundManager } from '../../common/utils/index.js';

// 游戏配置
const DIFFICULTY = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

class Minesweeper {
    constructor() {
        this.analytics = new GameAnalytics();
        this.leaderboard = new Leaderboard('minesweeper');
        this.soundManager = new SoundManager();
        this.initializeAudio();
        
        this.board = document.getElementById('board');
        this.minesLeftDisplay = document.getElementById('mines-left');
        this.timerDisplay = document.getElementById('timer');
        this.bestTimeDisplay = document.getElementById('best-time');
        this.gameOverPanel = document.getElementById('game-over');
        this.gameOverTitle = document.getElementById('game-over-title');
        this.gameOverMessage = document.getElementById('game-over-message');
        this.finalTimeDisplay = document.getElementById('final-time');
        
        this.difficulty = 'easy';
        this.cells = [];
        this.mines = new Set();
        this.revealed = new Set();
        this.flagged = new Set();
        this.isFirstClick = true;
        this.isGameOver = false;
        this.startTime = 0;
        this.timerInterval = null;
        
        this.initializeGame();
        this.bindEvents();
    }
    
    async initializeAudio() {
        await Promise.all([
            this.soundManager.loadSound('reveal', 'assets/reveal.wav'),
            this.soundManager.loadSound('flag', 'assets/flag.wav'),
            this.soundManager.loadSound('explosion', 'assets/explosion.wav'),
            this.soundManager.loadSound('win', 'assets/win.wav')
        ]);
    }
    
    initializeGame() {
        const { rows, cols, mines } = DIFFICULTY[this.difficulty];
        this.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        this.board.innerHTML = '';
        this.cells = [];
        this.mines.clear();
        this.revealed.clear();
        this.flagged.clear();
        this.isFirstClick = true;
        this.isGameOver = false;
        this.minesLeftDisplay.textContent = mines;
        
        // 创建单元格
        for (let i = 0; i < rows * cols; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            this.board.appendChild(cell);
            this.cells.push(cell);
        }
        
        // 加载最佳时间
        const bestTime = localStorage.getItem(`minesweeper_best_${this.difficulty}`);
        this.bestTimeDisplay.textContent = bestTime || '-';
        
        this.stopTimer();
        this.timerDisplay.textContent = '0';
    }
    
    bindEvents() {
        // 单元格点击事件
        this.board.addEventListener('click', (e) => {
            if (this.isGameOver) return;
            const cell = e.target.closest('.cell');
            if (!cell) return;
            
            const index = parseInt(cell.dataset.index);
            this.revealCell(index);
        });
        
        // 右键标记
        this.board.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.isGameOver) return;
            
            const cell = e.target.closest('.cell');
            if (!cell) return;
            
            const index = parseInt(cell.dataset.index);
            this.toggleFlag(index);
        });
        
        // 难度选择
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) return;
                
                document.querySelector('.difficulty-btn.active').classList.remove('active');
                btn.classList.add('active');
                this.difficulty = btn.dataset.difficulty;
                this.initializeGame();
            });
        });
    }
    
    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.timerDisplay.textContent = elapsed;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    placeMines(firstIndex) {
        const { rows, cols, mines } = DIFFICULTY[this.difficulty];
        const totalCells = rows * cols;
        
        while (this.mines.size < mines) {
            const index = Math.floor(Math.random() * totalCells);
            if (index !== firstIndex && !this.mines.has(index)) {
                this.mines.add(index);
            }
        }
    }
    
    getNeighbors(index) {
        const { rows, cols } = DIFFICULTY[this.difficulty];
        const row = Math.floor(index / cols);
        const col = index % cols;
        const neighbors = [];
        
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                
                const newRow = row + i;
                const newCol = col + j;
                
                if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
                    neighbors.push(newRow * cols + newCol);
                }
            }
        }
        
        return neighbors;
    }
    
    countAdjacentMines(index) {
        return this.getNeighbors(index).filter(i => this.mines.has(i)).length;
    }
    
    revealCell(index) {
        if (this.flagged.has(index)) return;
        if (this.revealed.has(index)) return;
        
        if (this.isFirstClick) {
            this.isFirstClick = false;
            this.placeMines(index);
            this.startTimer();
        }
        
        if (this.mines.has(index)) {
            this.gameOver(false);
            return;
        }
        
        this.soundManager.play('reveal');
        this.revealed.add(index);
        const cell = this.cells[index];
        cell.classList.add('revealed');
        
        const adjacentMines = this.countAdjacentMines(index);
        if (adjacentMines > 0) {
            cell.textContent = adjacentMines;
            cell.dataset.number = adjacentMines;
        } else {
            // 如果是空白格，递归揭示周围的格子
            this.getNeighbors(index).forEach(i => {
                if (!this.revealed.has(i)) {
                    this.revealCell(i);
                }
            });
        }
        
        this.checkWin();
    }
    
    toggleFlag(index) {
        if (this.revealed.has(index)) return;
        
        if (this.flagged.has(index)) {
            this.flagged.delete(index);
            this.cells[index].classList.remove('flagged');
        } else {
            this.flagged.add(index);
            this.cells[index].classList.add('flagged');
        }
        
        this.soundManager.play('flag');
        this.minesLeftDisplay.textContent = DIFFICULTY[this.difficulty].mines - this.flagged.size;
    }
    
    checkWin() {
        const { rows, cols, mines } = DIFFICULTY[this.difficulty];
        const totalCells = rows * cols;
        
        if (this.revealed.size === totalCells - mines) {
            this.gameOver(true);
        }
    }
    
    gameOver(isWin) {
        this.isGameOver = true;
        this.stopTimer();
        
        // 显示所有地雷
        this.mines.forEach(index => {
            const cell = this.cells[index];
            cell.classList.add('mine');
            cell.textContent = '💣';
        });
        
        const finalTime = parseInt(this.timerDisplay.textContent);
        this.finalTimeDisplay.textContent = finalTime;
        
        if (isWin) {
            this.soundManager.play('win');
            this.gameOverTitle.textContent = '恭喜胜利！';
            this.gameOverMessage.textContent = `用时: ${finalTime} 秒`;
            
            // 更新最佳时间
            const bestTime = localStorage.getItem(`minesweeper_best_${this.difficulty}`);
            if (!bestTime || finalTime < parseInt(bestTime)) {
                localStorage.setItem(`minesweeper_best_${this.difficulty}`, finalTime);
                this.bestTimeDisplay.textContent = finalTime;
            }
            
            // 记录成绩
            this.leaderboard.addScore(finalTime, 'Player');
        } else {
            this.soundManager.play('explosion');
            this.gameOverTitle.textContent = '游戏结束';
            this.gameOverMessage.textContent = '很遗憾，踩到地雷了！';
        }
        
        this.gameOverPanel.style.display = 'block';
        
        // 记录游戏数据
        this.analytics.logEvent('gameOver', {
            difficulty: this.difficulty,
            time: finalTime,
            isWin,
            revealed: this.revealed.size
        });
    }
}

// 重启游戏
window.restartGame = function() {
    location.reload();
};

// 启动游戏
new Minesweeper(); 