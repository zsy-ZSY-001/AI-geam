import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../hooks/useUser';
import { saveGameScore } from '../services/gameService';
import './Game2048.css';

interface Game2048Logic {
  getBoard: () => number[][];
  getScore: () => number;
  getHighScore: () => number;
  move: (direction: 'up' | 'down' | 'left' | 'right') => boolean;
  isGameOver: () => boolean;
  saveHighScore: (userId: string) => Promise<void>;
}

// 这里我们直接在前端实现游戏逻辑
// 在实际项目中，你可以从服务器导入或使用WebAssembly版本
class Game2048 implements Game2048Logic {
  private board: number[][];
  private size: number;
  private score: number;
  private highScore: number = 0;

  constructor(size: number = 4) {
    this.size = size;
    this.board = Array.from({ length: size }, () => 
      Array.from({ length: size }, () => 0)
    );
    this.score = 0;
    this.addRandomTile();
    this.addRandomTile();
  }

  private addRandomTile(): void {
    const emptyCells: [number, number][] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.board[row][col] === 0) {
          emptyCells.push([row, col]);
        }
      }
    }

    if (emptyCells.length > 0) {
      const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.board[row][col] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  private slide(row: number[]): number[] {
    let arr = row.filter(val => val !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        this.score += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < this.size) {
      arr.push(0);
    }
    return arr;
  }

  move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    let moved = false;

    if (direction === 'left' || direction === 'right') {
      for (let row = 0; row < this.size; row++) {
        let arr = [...this.board[row]];
        if (direction === 'right') arr = arr.reverse();
        arr = this.slide(arr);
        if (direction === 'right') arr = arr.reverse();
        
        // 判断是否移动
        if (!this.arraysEqual(arr, this.board[row])) {
          moved = true;
          this.board[row] = arr;
        }
      }
    } else {
      for (let col = 0; col < this.size; col++) {
        let arr = this.board.map(row => row[col]);
        if (direction === 'down') arr = arr.reverse();
        arr = this.slide(arr);
        if (direction === 'down') arr = arr.reverse();
        
        // 判断是否移动
        const oldCol = this.board.map(row => row[col]);
        if (!this.arraysEqual(arr, oldCol)) {
          moved = true;
          for (let row = 0; row < this.size; row++) {
            this.board[row][col] = arr[row];
          }
        }
      }
    }

    if (moved) {
      this.addRandomTile();
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
    }
    
    return moved;
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }

  getBoard(): number[][] {
    return this.board;
  }

  getScore(): number {
    return this.score;
  }

  getHighScore(): number {
    return this.highScore;
  }

  async saveHighScore(userId: string): Promise<void> {
    if (!userId) return;
    
    try {
      await saveGameScore('2048', userId, this.score, this.hasWon());
    } catch (error) {
      console.error('Failed to save high score', error);
    }
  }

  hasWon(): boolean {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.board[row][col] >= 2048) {
          return true;
        }
      }
    }
    return false;
  }

  isGameOver(): boolean {
    // 检查是否有空格
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.board[row][col] === 0) return false;
      }
    }
    
    // 检查是否有相邻的相同数字
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const current = this.board[row][col];
        // 检查右侧
        if (col < this.size - 1 && current === this.board[row][col + 1]) return false;
        // 检查下方
        if (row < this.size - 1 && current === this.board[row + 1][col]) return false;
      }
    }
    
    return true;
  }
}

const Game2048Component: React.FC = () => {
  const [game, setGame] = useState<Game2048Logic>(() => new Game2048());
  const [board, setBoard] = useState(() => game.getBoard());
  const [score, setScore] = useState(() => game.getScore());
  const [highScore, setHighScore] = useState(() => game.getHighScore());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const { user } = useUser();

  // 统一更新游戏状态
  const updateGameState = useCallback(() => {
    setBoard([...game.getBoard()]);
    setScore(game.getScore());
    setHighScore(game.getHighScore());
    
    const isWon = (game as Game2048).hasWon();
    if (isWon && !won) {
      setWon(true);
      if (user?.id) {
        game.saveHighScore(user.id);
      }
    }
    
    if (game.isGameOver() && !gameOver) {
      setGameOver(true);
      if (user?.id) {
        game.saveHighScore(user.id);
      }
    }
  }, [game, gameOver, won, user]);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;

      let direction: 'up' | 'down' | 'left' | 'right' | null = null;
      switch (e.key) {
        case 'ArrowUp': direction = 'up'; break;
        case 'ArrowDown': direction = 'down'; break;
        case 'ArrowLeft': direction = 'left'; break;
        case 'ArrowRight': direction = 'right'; break;
        default: return;
      }

      const moved = game.move(direction);
      if (moved) {
        updateGameState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game, gameOver, updateGameState]);

  // 处理触摸事件
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameOver) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || gameOver) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    
    // 添加滑动速度判断
    const minSwipeDistance = 50; // 最小滑动距离
    const maxSwipeTime = 300; // 最大滑动时间（毫秒）
    const swipeTime = Date.now() - touchStart.timestamp;
    
    if (swipeTime > maxSwipeTime) return;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipeDistance) {
        const direction = deltaX > 0 ? 'right' : 'left';
        const moved = game.move(direction);
        if (moved) updateGameState();
      }
    } else {
      if (Math.abs(deltaY) > minSwipeDistance) {
        const direction = deltaY > 0 ? 'down' : 'up';
        const moved = game.move(direction);
        if (moved) updateGameState();
      }
    }
    
    setTouchStart(null);
  };

  // 重新开始游戏
  const restartGame = () => {
    const newGame = new Game2048();
    setGame(newGame);
    setBoard(newGame.getBoard());
    setScore(newGame.getScore());
    setHighScore(prev => Math.max(prev, newGame.getHighScore()));
    setGameOver(false);
    setWon(false);
  };

  // 获取瓦片颜色
  const getTileColor = (value: number): string => {
    const colors: Record<number, string> = {
      0: '#cdc1b4',
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e'
    };
    
    return colors[value] || '#3c3a32';
  };

  return (
    <div className="game-2048-container">
      <div className="game-header">
        <h1>2048</h1>
        <div className="score-container">
          <div className="score-box">
            <div className="score-label">分数</div>
            <div className="score-value">{score}</div>
          </div>
          <div className="score-box">
            <div className="score-label">最高分</div>
            <div className="score-value">{highScore}</div>
          </div>
        </div>
        <button className="new-game-button" onClick={restartGame}>新游戏</button>
      </div>
      
      <div className="game-description">
        <p>使用方向键移动方块，相同数字合并在一起，尝试获得2048方块！</p>
      </div>
      
      {(gameOver || won) && (
        <div className="game-message">
          {won && <p className="win-message">你赢了！</p>}
          {gameOver && <p className="game-over-message">游戏结束！</p>}
          <button className="try-again-button" onClick={restartGame}>再试一次</button>
        </div>
      )}
      
      <div 
        className="board" 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                className={`cell cell-${cell}`}
                style={{ backgroundColor: getTileColor(cell) }}
              >
                {cell !== 0 && cell}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="game-instructions">
        <h3>如何玩</h3>
        <p>使用箭头键移动瓦片。相同数字的瓦片相撞时会合并成一个！</p>
        <p>在手机上，可以通过滑动屏幕来控制方向。</p>
      </div>
    </div>
  );
};

export default Game2048Component; 