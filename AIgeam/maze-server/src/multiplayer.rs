use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use std::collections::BTreeMap;
use chrono::Utc;
use chrono::Duration;

#[derive(Serialize, Deserialize, Clone)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub position: (i32, i32),
    pub chunk: (i32, i32),
    pub health: u8,
    pub inventory: Vec<Item>,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Item {
    Key { id: u32 },
    Potion { health: u8 },
    Treasure { value: u32 },
}

pub struct MultiplayerServer {
    players: RwLock<HashMap<Uuid, Player>>,
    event_tx: mpsc::UnboundedSender<GameEvent>,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum GameEvent {
    PlayerJoined(Player),
    PlayerLeft(Uuid),
    PlayerMoved { id: Uuid, position: (i32, i32) },
    PlayerInteracted { id: Uuid, item: Item },
    ChatMessage { id: Uuid, message: String },
}

impl MultiplayerServer {
    pub fn new(event_tx: mpsc::UnboundedSender<GameEvent>) -> Self {
        Self {
            players: RwLock::new(HashMap::new()),
            event_tx,
        }
    }

    pub async fn add_player(&self, name: String) -> Player {
        let player = Player {
            id: Uuid::new_v4(),
            name,
            position: (0, 0),
            chunk: (0, 0),
            health: 100,
            inventory: Vec::new(),
        };

        self.players.write().await.insert(player.id, player.clone());
        self.event_tx.send(GameEvent::PlayerJoined(player.clone())).unwrap();
        player
    }

    pub async fn remove_player(&self, id: Uuid) {
        self.players.write().await.remove(&id);
        self.event_tx.send(GameEvent::PlayerLeft(id)).unwrap();
    }

    pub async fn move_player(&self, id: Uuid, new_position: (i32, i32)) {
        if let Some(player) = self.players.write().await.get_mut(&id) {
            player.position = new_position;
            self.event_tx.send(GameEvent::PlayerMoved { id, position: new_position }).unwrap();
        }
    }

    pub async fn interact(&self, id: Uuid, item: Item) {
        if let Some(player) = self.players.write().await.get_mut(&id) {
            player.inventory.push(item.clone());
            self.event_tx.send(GameEvent::PlayerInteracted { id, item }).unwrap();
        }
    }

    pub async fn send_chat(&self, id: Uuid, message: String) {
        self.event_tx.send(GameEvent::ChatMessage { id, message }).unwrap();
    }

    pub async fn get_players_in_chunk(&self, chunk: (i32, i32)) -> Vec<Player> {
        self.players.read().await.values()
            .filter(|p| p.chunk == chunk)
            .cloned()
            .collect()
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Leaderboard {
    scores: BTreeMap<u32, Vec<ScoreEntry>>,
    achievements: HashMap<Uuid, Vec<Achievement>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScoreEntry {
    pub player_id: Uuid,
    pub player_name: String,
    pub score: u32,
    pub timestamp: chrono::DateTime<Utc>,
    pub game_mode: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Achievement {
    FirstGame,
    Score1000,
    Score10000,
    PerfectGame,
    SpeedRun { time: u32 },
}

impl Leaderboard {
    pub fn new() -> Self {
        Self {
            scores: BTreeMap::new(),
            achievements: HashMap::new(),
        }
    }

    pub fn add_score(&mut self, entry: ScoreEntry) {
        self.scores.entry(entry.score)
            .or_insert_with(Vec::new)
            .push(entry);
    }

    pub fn get_top_scores(&self, limit: usize) -> Vec<&ScoreEntry> {
        self.scores.iter()
            .rev()
            .flat_map(|(_, entries)| entries.iter())
            .take(limit)
            .collect()
    }

    pub fn unlock_achievement(&mut self, player_id: Uuid, achievement: Achievement) {
        self.achievements.entry(player_id)
            .or_insert_with(Vec::new)
            .push(achievement);
    }

    pub fn get_achievements(&self, player_id: Uuid) -> Vec<Achievement> {
        self.achievements.get(&player_id)
            .cloned()
            .unwrap_or_default()
    }
}

#[derive(Serialize, Deserialize)]
pub struct GameAnalytics {
    player_stats: HashMap<Uuid, PlayerStats>,
    game_events: Vec<GameEvent>,
}

#[derive(Serialize, Deserialize)]
pub struct PlayerStats {
    total_play_time: Duration,
    games_played: u32,
    highest_score: u32,
    achievements_unlocked: u32,
    last_played: chrono::DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub enum GameEvent {
    GameStart { player_id: Uuid, timestamp: chrono::DateTime<Utc> },
    GameEnd { player_id: Uuid, score: u32, duration: Duration },
    AchievementUnlocked { player_id: Uuid, achievement: String },
    PlayerAction { player_id: Uuid, action: String, timestamp: chrono::DateTime<Utc> },
}

impl GameAnalytics {
    pub fn new() -> Self {
        Self {
            player_stats: HashMap::new(),
            game_events: Vec::new(),
        }
    }

    pub fn record_event(&mut self, event: GameEvent) {
        self.game_events.push(event);
    }

    pub fn get_player_stats(&self, player_id: Uuid) -> Option<&PlayerStats> {
        self.player_stats.get(&player_id)
    }

    pub fn generate_report(&self) -> AnalyticsReport {
        let mut report = AnalyticsReport::default();

        for event in &self.game_events {
            match event {
                GameEvent::GameStart { player_id, timestamp } => {
                    report.total_games += 1;
                }
                GameEvent::GameEnd { player_id, score, duration } => {
                    report.total_play_time += *duration;
                    if *score > report.highest_score {
                        report.highest_score = *score;
                    }
                }
                GameEvent::AchievementUnlocked { player_id, achievement } => {
                    report.total_achievements += 1;
                }
                _ => {}
            }
        }

        report
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct AnalyticsReport {
    pub total_games: u32,
    pub total_play_time: Duration,
    pub highest_score: u32,
    pub total_achievements: u32,
    pub active_players: u32,
} 