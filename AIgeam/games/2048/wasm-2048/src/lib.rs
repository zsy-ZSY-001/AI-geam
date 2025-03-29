#![cfg(target_feature = "simd128")]
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::simd::{u32x4, mask32x4};

#[derive(Serialize, Deserialize)]
pub struct GameState {
    pub grid: [[u32; 4]; 4],
    pub score: u32,
    pub stats: GameStats,
}

#[derive(Serialize, Deserialize)]
pub struct GameStats {
    pub move_speed: f32,
    pub error_rate: f32,
    pub combo: u32,
}

#[wasm_bindgen]
pub struct Game2048 {
    state: GameState,
    rng: rand::rngs::ThreadRng,
}

#[wasm_bindgen]
impl Game2048 {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut game = Self {
            state: GameState {
                grid: [[0; 4]; 4],
                score: 0,
                stats: GameStats {
                    move_speed: 0.0,
                    error_rate: 0.0,
                    combo: 0,
                }
            },
            rng: rand::thread_rng(),
        };
        game.spawn_tile();
        game.spawn_tile();
        game
    }

    pub fn get_state(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.state).unwrap()
    }

    pub fn move_tiles(&mut self, direction: u8) -> bool {
        let moved = match direction {
            0 => self.move_up(),
            1 => self.move_right(),
            2 => self.move_down(),
            3 => self.move_left(),
            _ => false,
        };

        if moved {
            self.spawn_tile();
            self.update_stats();
        }
        moved
    }

    fn move_left(&mut self) -> bool {
        let mut moved = false;
        for row in &mut self.state.grid {
            let (new_row, row_moved) = self.merge_row_simd(row);
            *row = new_row;
            moved |= row_moved;
        }
        moved
    }

    fn merge_row_simd(&mut self, row: &[u32; 4]) -> ([u32; 4], bool) {
        let mut v = u32x4::from_array(*row);
        let zero = u32x4::splat(0);
        
        // 压缩非零元素
        let mut compressed = u32x4::splat(0);
        let mut idx = 0;
        
        for i in 0..4 {
            if v[i] != 0 {
                compressed[idx] = v[i];
                idx += 1;
            }
        }
        
        // 合并相同数字
        let mut merged = false;
        let mut result = u32x4::splat(0);
        let mut pos = 0;
        
        let mut i = 0;
        while i < idx {
            if i + 1 < idx && compressed[i] == compressed[i + 1] {
                result[pos] = compressed[i] * 2;
                self.state.score += result[pos];
                merged = true;
                i += 2;
            } else {
                result[pos] = compressed[i];
                i += 1;
            }
            pos += 1;
        }
        
        (result.to_array(), merged)
    }

    fn spawn_tile(&mut self) {
        let empty_cells: Vec<(usize, usize)> = (0..4)
            .flat_map(|i| (0..4).map(move |j| (i, j)))
            .filter(|&(i, j)| self.state.grid[i][j] == 0)
            .collect();

        if let Some(&(i, j)) = empty_cells.choose(&mut self.rng) {
            self.state.grid[i][j] = if self.rng.gen_bool(0.9) { 2 } else { 4 };
        }
    }

    fn update_stats(&mut self) {
        // 更新游戏统计信息
        self.state.stats.combo += 1;
        self.state.stats.move_speed = (self.state.stats.move_speed * 0.9 + 0.1).min(1.0);
    }
}

// 辅助函数
impl Game2048 {
    fn rotate_grid(&mut self) {
        let mut new_grid = [[0; 4]; 4];
        for i in 0..4 {
            for j in 0..4 {
                new_grid[i][j] = self.state.grid[3-j][i];
            }
        }
        self.state.grid = new_grid;
    }

    fn move_up(&mut self) -> bool {
        self.rotate_grid();
        let moved = self.move_left();
        self.rotate_grid();
        self.rotate_grid();
        self.rotate_grid();
        moved
    }

    fn move_right(&mut self) -> bool {
        self.rotate_grid();
        self.rotate_grid();
        let moved = self.move_left();
        self.rotate_grid();
        self.rotate_grid();
        moved
    }

    fn move_down(&mut self) -> bool {
        self.rotate_grid();
        self.rotate_grid();
        self.rotate_grid();
        let moved = self.move_left();
        self.rotate_grid();
        moved
    }
} 