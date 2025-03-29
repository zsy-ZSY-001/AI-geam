use serde::{Serialize, Deserialize};
use rand::Rng;
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct AIPlayer {
    difficulty: AILevel,
    learning_rate: f32,
    experience: HashMap<BoardState, Vec<(Direction, f32)>>,
    current_strategy: Strategy,
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum AILevel {
    Easy,
    Medium,
    Hard,
    Adaptive,
}

#[derive(Hash, Eq, PartialEq, Serialize, Deserialize, Clone)]
struct BoardState {
    grid: [[u32; 4]; 4],
    score: u32,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub enum Direction {
    Up,
    Right,
    Down,
    Left,
}

#[derive(Clone, Serialize, Deserialize)]
enum Strategy {
    CornerMax,
    SnakePattern,
    MonotonicRows,
    AdaptiveLearning {
        weights: Vec<f32>,
        last_move: Option<Direction>,
        last_state: Option<BoardState>,
    },
}

impl AIPlayer {
    pub fn new(difficulty: AILevel) -> Self {
        Self {
            difficulty,
            learning_rate: match difficulty {
                AILevel::Easy => 0.1,
                AILevel::Medium => 0.2,
                AILevel::Hard => 0.3,
                AILevel::Adaptive => 0.4,
            },
            experience: HashMap::new(),
            current_strategy: match difficulty {
                AILevel::Easy => Strategy::CornerMax,
                AILevel::Medium => Strategy::SnakePattern,
                AILevel::Hard => Strategy::MonotonicRows,
                AILevel::Adaptive => Strategy::AdaptiveLearning {
                    weights: vec![1.0, 1.0, 1.0, 1.0],
                    last_move: None,
                    last_state: None,
                },
            },
        }
    }

    pub fn get_next_move(&mut self, state: &BoardState) -> Direction {
        match &mut self.current_strategy {
            Strategy::CornerMax => self.corner_max_strategy(state),
            Strategy::SnakePattern => self.snake_pattern_strategy(state),
            Strategy::MonotonicRows => self.monotonic_rows_strategy(state),
            Strategy::AdaptiveLearning { weights, last_move, last_state } => {
                self.adaptive_learning_strategy(state, weights, last_move, last_state)
            }
        }
    }

    fn corner_max_strategy(&self, state: &BoardState) -> Direction {
        // 简单策略：尽量将最大数字保持在角落
        let corners = [
            state.grid[0][0],
            state.grid[0][3],
            state.grid[3][0],
            state.grid[3][3],
        ];
        
        let max_corner = corners.iter().max().unwrap();
        let max_value = state.grid.iter()
            .flat_map(|row| row.iter())
            .max()
            .unwrap();
            
        if max_corner == max_value {
            // 保持当前状态
            Direction::Left
        } else {
            // 尝试移动到角落
            let directions = [Direction::Left, Direction::Up];
            directions[rand::thread_rng().gen_range(0..2)]
        }
    }

    fn snake_pattern_strategy(&self, state: &BoardState) -> Direction {
        // 蛇形模式策略
        let mut score = HashMap::new();
        score.insert(Direction::Up, self.evaluate_snake_pattern(state, Direction::Up));
        score.insert(Direction::Right, self.evaluate_snake_pattern(state, Direction::Right));
        score.insert(Direction::Down, self.evaluate_snake_pattern(state, Direction::Down));
        score.insert(Direction::Left, self.evaluate_snake_pattern(state, Direction::Left));
        
        score.into_iter()
            .max_by_key(|&(_, score)| (score * 1000.0) as i32)
            .map(|(dir, _)| dir)
            .unwrap_or(Direction::Left)
    }

    fn evaluate_snake_pattern(&self, state: &BoardState, direction: Direction) -> f32 {
        let mut score = 0.0;
        let pattern = match direction {
            Direction::Left | Direction::Right => {
                // 横向蛇形
                vec![
                    vec![(0,0), (0,1), (0,2), (0,3)],
                    vec![(1,3), (1,2), (1,1), (1,0)],
                    vec![(2,0), (2,1), (2,2), (2,3)],
                    vec![(3,3), (3,2), (3,1), (3,0)],
                ]
            },
            Direction::Up | Direction::Down => {
                // 纵向蛇形
                vec![
                    vec![(0,0), (1,0), (2,0), (3,0)],
                    vec![(3,1), (2,1), (1,1), (0,1)],
                    vec![(0,2), (1,2), (2,2), (3,2)],
                    vec![(3,3), (2,3), (1,3), (0,3)],
                ]
            }
        };

        for (row_idx, row) in pattern.iter().enumerate() {
            let mut last_value = 0;
            for &(i, j) in row {
                let current = state.grid[i][j];
                if current > last_value {
                    score += current as f32;
                } else {
                    score -= (current as f32) * 0.5;
                }
                last_value = current;
            }
        }

        score
    }

    fn monotonic_rows_strategy(&self, state: &BoardState) -> Direction {
        // 单调行策略：确保每行（或列）都是单调递增或递减的
        let mut scores = HashMap::new();
        
        for direction in [Direction::Up, Direction::Right, Direction::Down, Direction::Left].iter() {
            let mut score = 0.0;
            
            // 评估行的单调性
            for row in 0..4 {
                let mut row_score = 0.0;
                let mut is_increasing = true;
                let mut is_decreasing = true;
                
                for col in 1..4 {
                    let prev = state.grid[row][col-1];
                    let curr = state.grid[row][col];
                    
                    if curr < prev {
                        is_increasing = false;
                    }
                    if curr > prev {
                        is_decreasing = false;
                    }
                }
                
                if is_increasing || is_decreasing {
                    row_score += state.grid[row].iter().sum::<u32>() as f32;
                }
                score += row_score;
            }
            
            scores.insert(*direction, score);
        }
        
        scores.into_iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(dir, _)| dir)
            .unwrap_or(Direction::Left)
    }

    fn adaptive_learning_strategy(
        &mut self,
        state: &BoardState,
        weights: &mut Vec<f32>,
        last_move: &mut Option<Direction>,
        last_state: &mut Option<BoardState>
    ) -> Direction {
        // 自适应学习策略
        if let (Some(prev_state), Some(prev_move)) = (last_state.clone(), *last_move) {
            // 计算上一步的奖励
            let reward = self.calculate_reward(state, &prev_state);
            
            // 更新权重
            self.update_weights(weights, reward, prev_move);
        }
        
        // 使用当前权重评估每个方向
        let mut best_direction = Direction::Left;
        let mut best_score = f32::NEG_INFINITY;
        
        for direction in [Direction::Up, Direction::Right, Direction::Down, Direction::Left].iter() {
            let features = self.extract_features(state, *direction);
            let score = features.iter()
                .zip(weights.iter())
                .map(|(f, w)| f * w)
                .sum::<f32>();
                
            if score > best_score {
                best_score = score;
                best_direction = *direction;
            }
        }
        
        // 更新状态
        *last_state = Some(state.clone());
        *last_move = Some(best_direction);
        
        best_direction
    }

    fn calculate_reward(&self, current: &BoardState, previous: &BoardState) -> f32 {
        let current_max = current.grid.iter()
            .flat_map(|row| row.iter())
            .max()
            .unwrap();
            
        let previous_max = previous.grid.iter()
            .flat_map(|row| row.iter())
            .max()
            .unwrap();
            
        let score_diff = current.score as f32 - previous.score as f32;
        let max_diff = (*current_max as f32 - *previous_max as f32) * 2.0;
        
        score_diff + max_diff
    }

    fn update_weights(&mut self, weights: &mut Vec<f32>, reward: f32, direction: Direction) {
        let direction_idx = match direction {
            Direction::Up => 0,
            Direction::Right => 1,
            Direction::Down => 2,
            Direction::Left => 3,
        };
        
        weights[direction_idx] += self.learning_rate * reward;
        
        // 归一化权重
        let sum: f32 = weights.iter().sum();
        for w in weights.iter_mut() {
            *w /= sum;
        }
    }

    fn extract_features(&self, state: &BoardState, direction: Direction) -> Vec<f32> {
        vec![
            self.empty_cells_after_move(state, direction),
            self.merge_potential(state, direction),
            self.edge_value(state, direction),
            self.monotonicity(state, direction),
        ]
    }

    fn empty_cells_after_move(&self, state: &BoardState, _direction: Direction) -> f32 {
        state.grid.iter()
            .flat_map(|row| row.iter())
            .filter(|&&cell| cell == 0)
            .count() as f32 / 16.0
    }

    fn merge_potential(&self, state: &BoardState, _direction: Direction) -> f32 {
        let mut potential = 0;
        
        // 检查行
        for row in state.grid.iter() {
            for i in 0..3 {
                if row[i] != 0 && row[i] == row[i+1] {
                    potential += 1;
                }
            }
        }
        
        // 检查列
        for col in 0..4 {
            for row in 0..3 {
                if state.grid[row][col] != 0 && state.grid[row][col] == state.grid[row+1][col] {
                    potential += 1;
                }
            }
        }
        
        potential as f32 / 24.0 // 最大可能的合并数
    }

    fn edge_value(&self, state: &BoardState, _direction: Direction) -> f32 {
        let edge_sum = state.grid[0][0] + state.grid[0][3] + state.grid[3][0] + state.grid[3][3];
        let max_value = state.grid.iter()
            .flat_map(|row| row.iter())
            .max()
            .unwrap();
            
        edge_sum as f32 / (*max_value as f32 * 4.0)
    }

    fn monotonicity(&self, state: &BoardState, _direction: Direction) -> f32 {
        let mut score = 0;
        
        // 检查行的单调性
        for row in state.grid.iter() {
            let mut is_increasing = true;
            let mut is_decreasing = true;
            
            for i in 1..4 {
                if row[i] < row[i-1] {
                    is_increasing = false;
                }
                if row[i] > row[i-1] {
                    is_decreasing = false;
                }
            }
            
            if is_increasing || is_decreasing {
                score += 1;
            }
        }
        
        // 检查列的单调性
        for col in 0..4 {
            let mut is_increasing = true;
            let mut is_decreasing = true;
            
            for row in 1..4 {
                if state.grid[row][col] < state.grid[row-1][col] {
                    is_increasing = false;
                }
                if state.grid[row][col] > state.grid[row-1][col] {
                    is_decreasing = false;
                }
            }
            
            if is_increasing || is_decreasing {
                score += 1;
            }
        }
        
        score as f32 / 8.0 // 最大可能的单调行/列数
    }
} 