// 游戏工作线程
// 处理碰撞检测、路径计算和游戏状态更新

let gameState = {
    snake: [],
    food: {},
    specialFood: null,
    walls: [],
    portals: [],
    gridSize: 20,
    canvasWidth: 0,
    canvasHeight: 0
};

// 处理从主线程接收的消息
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            gameState = { ...gameState, ...data };
            break;
            
        case 'update':
            const result = updateGameState(data);
            self.postMessage({ type: 'updateComplete', data: result });
            break;
            
        case 'checkCollision':
            const collision = checkCollision(data.head, data.snake);
            self.postMessage({ type: 'collisionResult', data: collision });
            break;
    }
};

// 更新游戏状态
function updateGameState(data) {
    const { direction, powerUp } = data;
    const head = { ...gameState.snake[0] };
    
    // 更新蛇头位置
    switch (direction) {
        case 'up': head.y -= 1; break;
        case 'down': head.y += 1; break;
        case 'left': head.x -= 1; break;
        case 'right': head.x += 1; break;
    }
    
    // 检查边界碰撞
    if (!powerUp || powerUp.effect !== 'invincible') {
        const gridCount = gameState.canvasWidth / gameState.gridSize;
        if (head.x < 0 || head.x >= gridCount || head.y < 0 || head.y >= gridCount) {
            return { gameOver: true };
        }
    } else {
        // 无敌状态下的环绕效果
        const gridCount = gameState.canvasWidth / gameState.gridSize;
        if (head.x < 0) head.x = gridCount - 1;
        if (head.x >= gridCount) head.x = 0;
        if (head.y < 0) head.y = gridCount - 1;
        if (head.y >= gridCount) head.y = 0;
    }
    
    // 检查自身碰撞
    if (checkCollision(head, gameState.snake)) {
        return { gameOver: true };
    }
    
    // 检查食物碰撞
    const ate = checkFoodCollision(head);
    
    return {
        gameOver: false,
        head,
        ate,
        portalEffect: checkPortalEffect(head)
    };
}

// 检查碰撞
function checkCollision(head, snake) {
    return snake.some(segment => segment.x === head.x && segment.y === head.y);
}

// 检查食物碰撞
function checkFoodCollision(head) {
    if (head.x === gameState.food.x && head.y === gameState.food.y) {
        return { type: 'normal', points: 10 };
    }
    
    if (gameState.specialFood && 
        head.x === gameState.specialFood.x && 
        head.y === gameState.specialFood.y) {
        return { type: 'special', food: gameState.specialFood };
    }
    
    return false;
}

// 检查传送门效果
function checkPortalEffect(head) {
    const portal = gameState.portals.find(p => p.x === head.x && p.y === head.y);
    return portal ? portal.target : null;
}

// AI路径查找算法
function findPath(start, target, obstacles) {
    // A*寻路算法实现
    const openSet = [start];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    gScore.set(JSON.stringify(start), 0);
    fScore.set(JSON.stringify(start), heuristic(start, target));
    
    while (openSet.length > 0) {
        const current = openSet.reduce((a, b) => 
            (fScore.get(JSON.stringify(b)) < fScore.get(JSON.stringify(a))) ? b : a
        );
        
        if (current.x === target.x && current.y === target.y) {
            return reconstructPath(cameFrom, current);
        }
        
        openSet.splice(openSet.indexOf(current), 1);
        closedSet.add(JSON.stringify(current));
        
        for (const neighbor of getNeighbors(current)) {
            if (closedSet.has(JSON.stringify(neighbor))) continue;
            if (obstacles.some(obs => obs.x === neighbor.x && obs.y === neighbor.y)) continue;
            
            const tentativeGScore = gScore.get(JSON.stringify(current)) + 1;
            
            if (!openSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
                openSet.push(neighbor);
            } else if (tentativeGScore >= gScore.get(JSON.stringify(neighbor))) {
                continue;
            }
            
            cameFrom.set(JSON.stringify(neighbor), current);
            gScore.set(JSON.stringify(neighbor), tentativeGScore);
            fScore.set(JSON.stringify(neighbor), tentativeGScore + heuristic(neighbor, target));
        }
    }
    
    return null;
}

// 启发式函数
function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 获取相邻节点
function getNeighbors(node) {
    return [
        { x: node.x + 1, y: node.y },
        { x: node.x - 1, y: node.y },
        { x: node.x, y: node.y + 1 },
        { x: node.x, y: node.y - 1 }
    ];
}

// 重建路径
function reconstructPath(cameFrom, current) {
    const path = [current];
    let currentKey = JSON.stringify(current);
    
    while (cameFrom.has(currentKey)) {
        current = cameFrom.get(currentKey);
        currentKey = JSON.stringify(current);
        path.unshift(current);
    }
    
    return path;
} 