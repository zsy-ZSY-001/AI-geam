const CACHE_NAME = 'snake-game-cache-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/gameWorker.js',
    '/gameCore.wasm',
    '/styles.css'
];

// Service Worker 安装
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('缓存已打开');
                return cache.addAll(ASSETS);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('删除旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// 处理请求
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 如果在缓存中找到响应，则返回缓存的响应
                if (response) {
                    return response;
                }
                
                // 克隆请求。请求是一个流，只能使用一次
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest)
                    .then((response) => {
                        // 检查是否收到有效的响应
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // 克隆响应。响应是一个流，只能使用一次
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // 将请求和响应都缓存
                                cache.put(event.request, responseToCache);
                            });
                            
                        return response;
                    });
            })
    );
});

// 处理后台同步
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-scores') {
        event.waitUntil(syncScores());
    }
});

// 处理推送通知
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: 'icon.png',
        badge: 'badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('贪吃蛇游戏', options)
    );
});

// 处理通知点击
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

// 同步分数
async function syncScores() {
    try {
        const db = await openDB();
        const scores = await db.getAll('scores');
        
        // 发送分数到服务器
        const response = await fetch('/api/sync-scores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scores)
        });
        
        if (response.ok) {
            // 清除已同步的分数
            const tx = db.transaction('scores', 'readwrite');
            await tx.objectStore('scores').clear();
            await tx.done;
        }
    } catch (error) {
        console.error('同步分数失败:', error);
    }
}

// 打开 IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('snake-game', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('scores')) {
                db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
} 