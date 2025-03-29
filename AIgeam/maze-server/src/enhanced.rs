use std::sync::Arc;
use tokio::sync::{mpsc, Semaphore};
use dashmap::DashMap;
use lru::LruCache;
use std::num::NonZeroUsize;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct EnhancedMazeServer {
    players: Arc<DashMap<Uuid, Player>>,
    chunks: Arc<LruCache<(i32, i32), ChunkData>>,
    event_tx: mpsc::UnboundedSender<GameEvent>,
    connection_limiter: Arc<Semaphore>,
    terrain_generator: Arc<TerrainGenerator>,
    ai_system: Arc<AISystem>,
    quest_system: Arc<QuestSystem>,
    economy_system: Arc<EconomySystem>,
}

impl EnhancedMazeServer {
    pub async fn new(
        addr: &str,
        max_connections: usize,
        terrain_seed: u64
    ) -> Self {
        let (event_tx, _) = mpsc::unbounded_channel();
        let terrain_generator = Arc::new(TerrainGenerator::new(terrain_seed));
        let ai_system = Arc::new(AISystem::new());
        let quest_system = Arc::new(QuestSystem::new());
        let economy_system = Arc::new(EconomySystem::new());

        Self {
            players: Arc::new(DashMap::new()),
            chunks: Arc::new(LruCache::new(NonZeroUsize::new(1000).unwrap())),
            event_tx,
            connection_limiter: Arc::new(Semaphore::new(max_connections)),
            terrain_generator,
            ai_system,
            quest_system,
            economy_system,
        }
    }

    pub async fn run(&self) {
        let listener = TcpListener::bind(addr).await.unwrap();
        while let Ok((socket, _)) = listener.accept().await {
            let permit = self.connection_limiter.clone().acquire_owned().await.unwrap();
            let server = self.clone();
            tokio::spawn(async move {
                if let Err(e) = handle_enhanced_connection(socket, server).await {
                    eprintln!("Connection error: {}", e);
                }
                drop(permit);
            });
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct QuestSystem {
    active_quests: Arc<DashMap<Uuid, Quest>>,
    completed_quests: Arc<DashMap<Uuid, Vec<Quest>>>,
}

impl QuestSystem {
    pub fn new() -> Self {
        Self {
            active_quests: Arc::new(DashMap::new()),
            completed_quests: Arc::new(DashMap::new()),
        }
    }

    pub async fn assign_quest(&self, player_id: Uuid, quest: Quest) {
        self.active_quests.insert(player_id, quest);
    }

    pub async fn complete_quest(&self, player_id: Uuid, quest_id: Uuid) {
        if let Some(quest) = self.active_quests.remove(&player_id) {
            self.completed_quests.entry(player_id)
                .or_insert_with(Vec::new)
                .push(quest);
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Quest {
    CollectItems { item_id: u32, quantity: u32 },
    DefeatMonsters { monster_id: u32, count: u32 },
    ExploreArea { chunk_x: i32, chunk_y: i32, radius: u32 },
    DeliverItem { item_id: u32, npc_id: Uuid },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EconomySystem {
    player_balances: Arc<DashMap<Uuid, u32>>,
    market: Arc<DashMap<u32, MarketItem>>,
}

impl EconomySystem {
    pub fn new() -> Self {
        Self {
            player_balances: Arc::new(DashMap::new()),
            market: Arc::new(DashMap::new()),
        }
    }

    pub async fn add_currency(&self, player_id: Uuid, amount: u32) {
        self.player_balances.entry(player_id)
            .and_modify(|balance| *balance += amount)
            .or_insert(amount);
    }

    pub async fn buy_item(&self, player_id: Uuid, item_id: u32) -> Result<(), String> {
        if let Some(item) = self.market.get(&item_id) {
            let balance = self.player_balances.get(&player_id).map(|b| *b).unwrap_or(0);
            if balance >= item.price {
                self.player_balances.entry(player_id)
                    .and_modify(|balance| *balance -= item.price);
                Ok(())
            } else {
                Err("Insufficient funds".to_string())
            }
        } else {
            Err("Item not found".to_string())
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MarketItem {
    pub id: u32,
    pub name: String,
    pub price: u32,
    pub quantity: u32,
} 