export class Game2048 {
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
    const oldBoard = this.board.map(row => [...row]);

    if (direction === 'left' || direction === 'right') {
      for (let row = 0; row < this.size; row++) {
        let arr = this.board[row];
        if (direction === 'right') arr = arr.reverse();
        arr = this.slide(arr);
        if (direction === 'right') arr = arr.reverse();
        if (!arraysEqual(arr, this.board[row])) moved = true;
        this.board[row] = arr;
      }
    } else {
      for (let col = 0; col < this.size; col++) {
        let arr = this.board.map(row => row[col]);
        if (direction === 'down') arr = arr.reverse();
        arr = this.slide(arr);
        if (direction === 'down') arr = arr.reverse();
        if (!arraysEqual(arr, this.board.map(row => row[col]))) moved = true;
        for (let row = 0; row < this.size; row++) {
          this.board[row][col] = arr[row];
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
    if (this.score > this.highScore) {
      this.highScore = this.score;
      
      try {
        // 动态导入GameAnalytics服务
        const { GameAnalytics } = await import('../../services/GameAnalytics');
        const analytics = new GameAnalytics();
        await analytics.recordGamePlay(
          userId,
          '2048',
          this.score,
          this.hasWon()
        );
      } catch (error) {
        console.error('Failed to save high score:', error);
        // 添加回退机制，如本地存储
        localStorage.setItem('2048_high_score', this.highScore.toString());
      }
    }
  }

  // 添加判断是否获胜的方法（通常2048游戏是达到2048瓦片）
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
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.board[row][col] === 0) return false;
        if (col < this.size - 1 && this.board[row][col] === this.board[row][col + 1]) return false;
        if (row < this.size - 1 && this.board[row][col] === this.board[row + 1][col]) return false;
      }
    }
    return true;
  }
}

function arraysEqual(a: any[], b: any[]): boolean {
  return a.length === b.length && a.every((val, index) => val === b[index]);
} 