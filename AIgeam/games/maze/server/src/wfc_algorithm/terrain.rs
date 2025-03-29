use ndarray::Array2;
use noise::{Perlin, NoiseFn, Seedable};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum Biome {
    Forest,
    Desert,
    Mountain,
    Lake,
    Cave,
}

#[derive(Serialize, Deserialize)]
pub struct TerrainCell {
    pub height: f32,
    pub moisture: f32,
    pub temperature: f32,
    pub biome: Biome,
    pub features: Vec<TerrainFeature>,
}

#[derive(Serialize, Deserialize)]
pub enum TerrainFeature {
    Tree { height: f32, type_id: u8 },
    Rock { size: f32 },
    Water { depth: f32 },
    Portal { destination: (i32, i32) },
    Treasure { rarity: u8 },
}

pub struct TerrainGenerator {
    height_noise: Perlin,
    moisture_noise: Perlin,
    temp_noise: Perlin,
    feature_noise: Perlin,
}

impl TerrainGenerator {
    pub fn new(seed: u64) -> Self {
        Self {
            height_noise: Perlin::new().set_seed(seed as u32),
            moisture_noise: Perlin::new().set_seed((seed + 1) as u32),
            temp_noise: Perlin::new().set_seed((seed + 2) as u32),
            feature_noise: Perlin::new().set_seed((seed + 3) as u32),
        }
    }

    pub fn generate_chunk(&self, chunk_x: i32, chunk_y: i32) -> Array2<TerrainCell> {
        let size = 16;
        let mut terrain = Array2::from_elem((size, size), TerrainCell::default());

        for y in 0..size {
            for x in 0..size {
                let wx = (chunk_x * size as i32 + x as i32) as f64 / 50.0;
                let wy = (chunk_y * size as i32 + y as i32) as f64 / 50.0;

                let height = (self.height_noise.get([wx, wy]) + 1.0) / 2.0;
                let moisture = (self.moisture_noise.get([wx * 2.0, wy * 2.0]) + 1.0) / 2.0;
                let temperature = (self.temp_noise.get([wx * 0.5, wy * 0.5]) + 1.0) / 2.0;

                let biome = self.determine_biome(height as f32, moisture as f32, temperature as f32);
                let features = self.generate_features(x, y, &biome);

                terrain[[y, x]] = TerrainCell {
                    height: height as f32,
                    moisture: moisture as f32,
                    temperature: temperature as f32,
                    biome,
                    features,
                };
            }
        }

        // 添加特殊地形特征
        self.add_special_features(&mut terrain, chunk_x, chunk_y);
        terrain
    }

    fn determine_biome(&self, height: f32, moisture: f32, temperature: f32) -> Biome {
        match (height, moisture, temperature) {
            (h, _, _) if h > 0.8 => Biome::Mountain,
            (h, m, t) if h < 0.3 && m > 0.6 => Biome::Lake,
            (_, m, t) if m > 0.6 && t > 0.4 => Biome::Forest,
            (_, m, t) if m < 0.3 && t > 0.6 => Biome::Desert,
            _ => Biome::Cave,
        }
    }

    fn generate_features(&self, x: usize, y: usize, biome: &Biome) -> Vec<TerrainFeature> {
        let mut features = Vec::new();
        let feature_value = self.feature_noise.get([x as f64 * 0.1, y as f64 * 0.1]);

        match biome {
            Biome::Forest if feature_value > 0.7 => {
                features.push(TerrainFeature::Tree {
                    height: (feature_value as f32 + 1.0) * 2.0,
                    type_id: (feature_value * 3.0) as u8,
                });
            }
            Biome::Mountain if feature_value > 0.6 => {
                features.push(TerrainFeature::Rock {
                    size: feature_value as f32 + 0.5,
                });
            }
            Biome::Lake => {
                features.push(TerrainFeature::Water {
                    depth: (feature_value as f32 + 1.0) * 1.5,
                });
            }
            _ => {}
        }

        // 随机添加宝藏
        if feature_value > 0.95 {
            features.push(TerrainFeature::Treasure {
                rarity: (feature_value * 10.0) as u8,
            });
        }

        features
    }

    fn add_special_features(&self, terrain: &mut Array2<TerrainCell>, chunk_x: i32, chunk_y: i32) {
        // 在特定条件下添加传送门
        if self.should_add_portal(chunk_x, chunk_y) {
            let portal_pos = self.find_suitable_portal_location(terrain);
            if let Some((x, y)) = portal_pos {
                let destination = self.calculate_portal_destination(chunk_x, chunk_y);
                terrain[[y, x]].features.push(TerrainFeature::Portal {
                    destination,
                });
            }
        }
    }

    fn should_add_portal(&self, chunk_x: i32, chunk_y: i32) -> bool {
        let portal_chance = self.feature_noise.get([chunk_x as f64 * 0.05, chunk_y as f64 * 0.05]);
        portal_chance > 0.9
    }

    fn find_suitable_portal_location(&self, terrain: &Array2<TerrainCell>) -> Option<(usize, usize)> {
        // 寻找适合放置传送门的位置（平坦、无水）
        for y in 1..15 {
            for x in 1..15 {
                if terrain[[y, x]].height > 0.3 && terrain[[y, x]].height < 0.7 {
                    if !terrain[[y, x]].features.iter().any(|f| matches!(f, TerrainFeature::Water{..})) {
                        return Some((x, y));
                    }
                }
            }
        }
        None
    }

    fn calculate_portal_destination(&self, current_x: i32, current_y: i32) -> (i32, i32) {
        // 计算传送门目的地，确保不会太近或太远
        let angle = self.feature_noise.get([current_x as f64 * 0.1, current_y as f64 * 0.1]) * std::f64::consts::PI * 2.0;
        let distance = 5 + (self.feature_noise.get([current_x as f64 * 0.2, current_y as f64 * 0.2]) * 5.0) as i32;
        
        let dest_x = current_x + (angle.cos() * distance as f64) as i32;
        let dest_y = current_y + (angle.sin() * distance as f64) as i32;
        
        (dest_x, dest_y)
    }
}

impl Default for TerrainCell {
    fn default() -> Self {
        Self {
            height: 0.0,
            moisture: 0.0,
            temperature: 0.0,
            biome: Biome::Forest,
 