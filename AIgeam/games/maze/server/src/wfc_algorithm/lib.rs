use ndarray::{Array2, arr2};
use noise::{Perlin, NoiseFn};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

pub struct WaveFunctionCollapse {
    patterns: Vec<Array2<u8>>,
    rng: StdRng,
    noise: Perlin,
}

impl WaveFunctionCollapse {
    pub fn new(seed: u64) -> Self {
        let base_patterns = vec![
            arr2(&[[1, 1], [1, 1]]),  // 空地
            arr2(&[[0, 1], [1, 1]]),  // 墙壁边缘
            arr2(&[[1, 0], [1, 1]]),  // 另一种边缘
        ];
        
        Self {
            patterns: base_patterns,
            rng: StdRng::seed_from_u64(seed),
            noise: Perlin::new(),
        }
    }

    pub fn generate_chunk(&mut self, chunk_x: i32, chunk_y: i32) -> Array2<u8> {
        let size = 16;
        let mut grid = Array2::zeros((size, size));
        
        // 使用柏林噪声生成基础地形
        for y in 0..size {
            for x in 0..size {
                let wx = (chunk_x * size as i32 + x as i32) as f64 / 20.0;
                let wy = (chunk_y * size as i32 + y as i32) as f64 / 20.0;
                let value = self.noise.get([wx, wy]);
                
                grid[[y, x]] = if value > 0.3 { 1 } else { 0 };
            }
        }
        
        // 应用WFC算法优化
        self.apply_wfc(&mut grid);
        grid
    }

    fn apply_wfc(&mut self, grid: &mut Array2<u8>) {
        // 简化的WFC实现
        for y in 1..grid.shape()[0]-1 {
            for x in 1..grid.shape()[1]-1 {
                let neighborhood = self.get_neighborhood(grid, y, x);
                let possible = self.get_possible_patterns(&neighborhood);
                
                if !possible.is_empty() {
                    let chosen = possible[self.rng.gen_range(0..possible.len())];
                    grid[[y, x]] = chosen[[1, 1]]; // 取中心点
                }
            }
        }
    }

    fn get_neighborhood(&self, grid: &Array2<u8>, y: usize, x: usize) -> Array2<u8> {
        let mut neighborhood = Array2::zeros((3, 3));
        for dy in 0..3 {
            for dx in 0..3 {
                neighborhood[[dy, dx]] = grid[[y+dy-1, x+dx-1]];
            }
        }
        neighborhood
    }

    fn get_possible_patterns(&self, neighborhood: &Array2<u8>) -> Vec<&Array2<u8>> {
        self.patterns.iter()
            .filter(|pattern| self.pattern_fits(pattern, neighborhood))
            .collect()
    }

    fn pattern_fits(&self, pattern: &Array2<u8>, neighborhood: &Array2<u8>) -> bool {
        // 简单的模式匹配
        pattern[[0, 0]] == neighborhood[[1, 1]] ||
        pattern[[0, 1]] == neighborhood[[1, 1]]
    }
} 