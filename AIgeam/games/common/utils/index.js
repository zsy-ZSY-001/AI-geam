// 游戏统计分析
export class GameAnalytics {
    constructor() {
        this.events = [];
        this.startTime = Date.now();
    }

    // 记录游戏事件
    logEvent(eventName, data = {}) {
        this.events.push({
            timestamp: Date.now(),
            event: eventName,
            data
        });
    }

    // 获取游戏时长
    getPlayTime() {
        return Date.now() - this.startTime;
    }

    // 生成游戏报告
    generateReport() {
        return {
            totalPlayTime: this.getPlayTime(),
            events: this.events,
            summary: this.summarizeEvents()
        };
    }

    // 统计事件
    summarizeEvents() {
        const summary = {};
        this.events.forEach(event => {
            summary[event.event] = (summary[event.event] || 0) + 1;
        });
        return summary;
    }
}

// 高分榜管理
export class Leaderboard {
    constructor(gameName) {
        this.gameName = gameName;
        this.scores = JSON.parse(localStorage.getItem(`${gameName}_scores`) || '[]');
    }

    // 添加分数
    addScore(score, playerName) {
        const entry = {
            score,
            playerName,
            date: new Date().toISOString()
        };
        this.scores.push(entry);
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 10); // 只保留前10名
        this.saveScores();
        return this.getRank(score);
    }

    // 获取排名
    getRank(score) {
        return this.scores.findIndex(entry => entry.score === score) + 1;
    }

    // 获取前N名
    getTopScores(n = 10) {
        return this.scores.slice(0, n);
    }

    // 保存分数
    saveScores() {
        localStorage.setItem(`${this.gameName}_scores`, JSON.stringify(this.scores));
    }
}

// 成就系统
export class AchievementSystem {
    constructor(gameName) {
        this.gameName = gameName;
        this.achievements = JSON.parse(localStorage.getItem(`${this.gameName}_achievements`) || '{}');
    }

    // 添加成就
    addAchievement(id, data) {
        if (!this.achievements[id]) {
            this.achievements[id] = {
                ...data,
                unlocked: false,
                unlockDate: null
            };
            this.saveAchievements();
        }
    }

    // 解锁成就
    unlockAchievement(id) {
        if (this.achievements[id] && !this.achievements[id].unlocked) {
            this.achievements[id].unlocked = true;
            this.achievements[id].unlockDate = new Date().toISOString();
            this.saveAchievements();
            this.showNotification(this.achievements[id]);
            return true;
        }
        return false;
    }

    // 显示成就通知
    showNotification(achievement) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <h3>🏆 解锁成就</h3>
            <p>${achievement.name}</p>
            <p class="description">${achievement.description}</p>
        `;

        // 添加到页面
        document.body.appendChild(notification);

        // 动画效果
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // 自动移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }

    // 保存成就
    saveAchievements() {
        localStorage.setItem(`${this.gameName}_achievements`, JSON.stringify(this.achievements));
    }

    // 获取所有成就
    getAllAchievements() {
        return this.achievements;
    }

    // 获取已解锁成就
    getUnlockedAchievements() {
        return Object.entries(this.achievements)
            .filter(([, achievement]) => achievement.unlocked)
            .reduce((acc, [id, achievement]) => {
                acc[id] = achievement;
                return acc;
            }, {});
    }
}

// 音效管理器
export class SoundManager {
    constructor() {
        this.sounds = {};
        this.muted = localStorage.getItem('soundMuted') === 'true';
    }

    // 加载音效
    loadSound(name, url) {
        this.sounds[name] = new Audio(url);
        return new Promise((resolve, reject) => {
            this.sounds[name].addEventListener('canplaythrough', resolve);
            this.sounds[name].addEventListener('error', reject);
        });
    }

    // 播放音效
    play(name, volume = 1) {
        if (this.muted || !this.sounds[name]) return;
        
        const sound = this.sounds[name].cloneNode();
        sound.volume = volume;
        sound.play();
    }

    // 切换静音
    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('soundMuted', this.muted);
        return this.muted;
    }
}

// 游戏存档管理
export class SaveManager {
    constructor(gameName) {
        this.gameName = gameName;
    }

    // 保存游戏
    save(data) {
        const saveData = {
            timestamp: Date.now(),
            data
        };
        localStorage.setItem(`${this.gameName}_save`, JSON.stringify(saveData));
    }

    // 加载游戏
    load() {
        const saveData = localStorage.getItem(`${this.gameName}_save`);
        return saveData ? JSON.parse(saveData) : null;
    }

    // 删除存档
    delete() {
        localStorage.removeItem(`${this.gameName}_save`);
    }

    // 检查是否有存档
    hasSave() {
        return !!localStorage.getItem(`${this.gameName}_save`);
    }
}

// 动画管理器
export class AnimationManager {
    constructor() {
        this.animations = new Map();
        this.frameId = null;
    }

    // 添加动画
    add(name, callback, duration, easing = t => t) {
        this.animations.set(name, {
            callback,
            duration,
            easing,
            startTime: performance.now(),
            isRunning: true
        });

        if (!this.frameId) {
            this.frameId = requestAnimationFrame(this.update.bind(this));
        }
    }

    // 更新动画
    update(currentTime) {
        for (const [name, animation] of this.animations.entries()) {
            if (!animation.isRunning) continue;

            const elapsed = currentTime - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            const easedProgress = animation.easing(progress);

            animation.callback(easedProgress);

            if (progress >= 1) {
                animation.isRunning = false;
                this.animations.delete(name);
            }
        }

        if (this.animations.size > 0) {
            this.frameId = requestAnimationFrame(this.update.bind(this));
        } else {
            this.frameId = null;
        }
    }

    // 停止动画
    stop(name) {
        if (this.animations.has(name)) {
            this.animations.get(name).isRunning = false;
            this.animations.delete(name);
        }
    }

    // 停止所有动画
    stopAll() {
        this.animations.clear();
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }
}

// 工具函数
export const utils = {
    // 随机整数
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // 随机颜色
    randomColor() {
        return `#${Math.floor(Math.random()*16777215).toString(16)}`;
    },

    // 防抖
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 节流
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // 深拷贝
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [key, this.deepClone(value)])
            );
        }
    },

    // 格式化时间
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
}; 