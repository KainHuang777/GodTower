// ============================================================
// src/main.ts — 五行迷宮塔防 核心遊戲邏輯
// ============================================================

import { BASE_TOWERS, getTowerDef, getSameMergeResult, getCrossRecipeResult, getElementBonus, getSellPrice, type TowerDef, type TowerTypeId, type Element } from './towers';
import { ENEMY_DEFS, getWaveConfig, type EnemyTypeId } from './enemies';
import { loadTalentData, getAvailablePoints, canUnlockTalent, unlockTalent, calcTalentPointsEarned, addTalentPoints, getBaseHP, getStartGold, getDamageMultiplier, getTowerElementDamageMultiplier, getFireRateMultiplier, isTowerUnlocked, resetTalents, TALENT_TREE, type TalentSaveData } from './talent';
import { initSprites, drawEnemySprite, drawTowerSprite } from './sprites';

// --- 常數 ---
const COLS = 80;
const ROWS = 40;
const TILE_SIZE = 16;

interface Point { x: number; y: number; }

const SPAWN_POINT: Point = { x: 0, y: 20 };
const BASE_POINT: Point = { x: 79, y: 20 };
const WAYPOINTS: Point[] = [
  { x: 13, y: 8 }, { x: 26, y: 32 }, { x: 40, y: 8 }, { x: 53, y: 32 }, { x: 66, y: 15 }
];

// --- 場景管理 ---
type GameScene = 'MAIN_MENU' | 'TALENT_SCREEN' | 'BATTLE' | 'GAME_OVER';
let currentScene: GameScene = 'MAIN_MENU';
let animFrameId: number | null = null;

// --- 遊戲狀態 ---
let hp = 20;
let gold = 60;
let wave = 0;
let killCount = 0;
let isWaveActive = false;
let talentData: TalentSaveData;
let totalDamageDealt = 0;       // 本局總傷害
let currentKillStreak = 0;      // 當前連殺計數（波次內）
let maxKillStreak = 0;          // 最高連殺記錄
const grid: number[][] = Array.from({ length: COLS }, () => Array(ROWS).fill(0));

// --- 實體定義 ---
interface Enemy {
  id: number;
  type: EnemyTypeId;
  element: Element;
  x: number; y: number;
  currentGridX: number; currentGridY: number;
  hp: number; maxHp: number;
  speed: number; baseSpeed: number;
  goldAward: number;
  isFlying: boolean;
  waypointIndex: number;
  path: Point[]; pathIndex: number;
  slowDuration: number;
  dotDamage: number; dotDuration: number;
}

interface Tower {
  id: number;
  x: number; y: number;
  typeId: TowerTypeId;
  def: TowerDef;
  cooldown: number;
}

interface Bullet {
  x: number; y: number;
  targetEnemy: Enemy;
  speed: number;
  damage: number;
  element: Element;
  // 特殊效果繼承
  slowPct?: number; slowDuration?: number;
  dotDamage?: number; dotDuration?: number;
  aoeRadius?: number; aoeDamagePct?: number;
  hpPctDamage?: number;
  critChance?: number; critMultiplier?: number;
  flyingBonus?: number;
  healBase?: number;
  spawnWall?: boolean;
}

interface FloatingText {
  x: number; y: number; text: string; color: string; alpha: number; life: number;
  fontSize?: number;
}

interface TempWall {
  x: number; y: number; lifetime: number; // 剩餘幀數
}

let enemies: Enemy[] = [];
let towers: Tower[] = [];
let bullets: Bullet[] = [];
let floatingTexts: FloatingText[] = [];
let tempWalls: TempWall[] = [];
let nextEnemyId = 1;
let nextTowerId = 1;
let selectedTool: string = 'earth'; // 預設選擇岩壁塔
let mergeMode = false;
let mergeFirstTower: Tower | null = null;
let spawnTimers: ReturnType<typeof setInterval>[] = [];
let routePreviewTimer = 0;
let cachedPreviewRoute: Point[] = [];

// --- 波次進度追蹤 ---
let waveTotal = 0;    // 本波應生成總怪物數
let waveSpawned = 0;  // 本波已生成怪物數

// --- DOM 元素 ---
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hpVal = document.getElementById('hpVal')!;
const goldVal = document.getElementById('goldVal')!;
const waveVal = document.getElementById('waveVal')!;
const killVal = document.getElementById('killVal')!;
const btnStartWave = document.getElementById('btnStartWave')! as HTMLButtonElement;
const btnMerge = document.getElementById('btnMerge')!;
const btnSell = document.getElementById('btnSell')!;
const btnQuitBattle = document.getElementById('btnQuitBattle')!;
const btnShowRoute = document.getElementById('btnShowRoute')!;
const instructionText = document.getElementById('instructionText')!;
const towerButtonsContainer = document.getElementById('towerButtons')!;
const waveProgressFill = document.getElementById('waveProgressFill')!;
const waveProgressLabel = document.getElementById('waveProgressLabel')!;
const waveEnemyCount = document.getElementById('waveEnemyCount')!;

// 場景元素
const mainMenuEl = document.getElementById('mainMenu')!;
const talentScreenEl = document.getElementById('talentScreen')!;
const gameOverScreenEl = document.getElementById('gameOverScreen')!;
const battleSceneEl = document.getElementById('battleScene')!;

// ============================================================
// 1. 場景切換
// ============================================================

function switchScene(scene: GameScene) {
  currentScene = scene;
  mainMenuEl.classList.remove('active');
  talentScreenEl.classList.remove('active');
  gameOverScreenEl.classList.remove('active');
  battleSceneEl.classList.remove('active');

  switch (scene) {
    case 'MAIN_MENU':
      mainMenuEl.classList.add('active');
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      refreshMenuTalentInfo();
      break;
    case 'TALENT_SCREEN':
      talentScreenEl.classList.add('active');
      renderTalentScreen();
      break;
    case 'BATTLE':
      battleSceneEl.classList.add('active');
      startBattle();
      break;
    case 'GAME_OVER':
      gameOverScreenEl.classList.add('active');
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      break;
  }
}

function refreshMenuTalentInfo() {
  const info = document.getElementById('menuTalentInfo')!;
  const pts = getAvailablePoints(talentData);
  const total = talentData.totalTalentPoints;
  info.textContent = total > 0 ? `🌟 天賦點: ${pts} 可用 / ${total} 總計` : '尚未獲得天賦點';
}

// ============================================================
// 2. 天賦頁面渲染
// ============================================================

function renderTalentScreen() {
  const grid = document.getElementById('talentGrid')!;
  grid.innerHTML = '';
  document.getElementById('talentPointsVal')!.textContent = getAvailablePoints(talentData).toString();

  const categories: { key: string; label: string }[] = [
    { key: 'base', label: '🛡️ 基礎強化' },
    { key: 'attack', label: '⚔️ 攻擊強化' },
    { key: 'element', label: '🌿 五行解鎖' },
    { key: 'yinyang', label: '☯️ 陰陽解鎖' },
  ];

  for (const cat of categories) {
    const titleEl = document.createElement('div');
    titleEl.className = 'talent-category-title';
    titleEl.textContent = cat.label;
    grid.appendChild(titleEl);

    const nodes = TALENT_TREE.filter(t => t.category === cat.key);
    for (const node of nodes) {
      const el = document.createElement('div');
      el.className = 'talent-node';

      const level = talentData.talentLevels[node.id] || 0;
      const isMax = level >= node.maxLevel;
      const canUpgrade = canUnlockTalent(talentData, node.id);

      if (level === 0) {
        if (canUpgrade) el.classList.add('available');
        else el.classList.add('locked');
      } else {
        el.classList.add('unlocked');
        if (canUpgrade && !isMax) el.classList.add('available');
      }

      el.innerHTML = `
        <div class="t-name">${node.name} <span style="font-size:0.8rem;color:#f59e0b;">(Lv.${level}/${node.maxLevel})</span></div>
        <div class="t-desc">${node.description}</div>
        <div class="t-cost">${isMax ? '✨ 已滿級' : `升級花費: ${node.cost} 點`}</div>
      `;

      if (canUpgrade && !isMax) {
        el.addEventListener('click', () => {
          unlockTalent(talentData, node.id);
          renderTalentScreen();
        });
      }

      grid.appendChild(el);
    }
  }
}

// ============================================================
// 3. 戰鬥初始化
// ============================================================

function startBattle() {
  // 讀取天賦效果
  hp = getBaseHP(talentData);
  gold = getStartGold(talentData);
  wave = 0;
  killCount = 0;
  isWaveActive = false;
  totalDamageDealt = 0;
  currentKillStreak = 0;
  maxKillStreak = 0;
  enemies = [];
  towers = [];
  bullets = [];
  floatingTexts = [];
  tempWalls = [];
  nextEnemyId = 1;
  nextTowerId = 1;
  mergeMode = false;
  mergeFirstTower = null;
  spawnTimers.forEach(t => clearInterval(t));
  spawnTimers = [];
  waveTotal = 0;
  waveSpawned = 0;

  // 清空網格
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) grid[x][y] = 0;

  // 動態生成砲台按鈕
  buildTowerButtons();
  selectedTool = 'earth';
  refreshToolSelection();
  updateUI();

  // 啟動遊戲迴圈
  if (animFrameId) cancelAnimationFrame(animFrameId);
  gameLoop();
}

function buildTowerButtons() {
  towerButtonsContainer.innerHTML = '';
  const towerIds: TowerTypeId[] = ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'];

  for (const tid of towerIds) {
    const def = BASE_TOWERS[tid];
    if (!def) continue;
    const unlocked = isTowerUnlocked(talentData, tid);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.setAttribute('data-tool', tid);
    btn.disabled = !unlocked;
    btn.textContent = `${def.emoji} ${def.name} (${def.cost}g)`;
    if (!unlocked) btn.title = '需先在天賦頁解鎖';
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      mergeMode = false;
      mergeFirstTower = null;
      selectedTool = tid;
      refreshToolSelection();
    });
    towerButtonsContainer.appendChild(btn);
  }
}

function refreshToolSelection() {
  const allBtns = towerButtonsContainer.querySelectorAll('.btn');
  allBtns.forEach(b => b.classList.remove('active'));
  const activeBtn = towerButtonsContainer.querySelector(`[data-tool="${selectedTool}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  btnMerge.classList.toggle('active', mergeMode);
  btnSell.classList.toggle('active', selectedTool === 'sell');

  if (mergeMode) {
    instructionText.innerHTML = '<span class="merge-hint">🔮 合成模式：點擊一座塔選為材料，再點擊相鄰的塔進行合成</span>';
  } else if (selectedTool === 'sell') {
    instructionText.textContent = '💰 拆除模式：點擊砲台將其拆除並退回部分金幣';
  } else {
    instructionText.innerHTML = '選擇砲台後點擊地圖擺放。怪物依序碰觸 <span style="color:#f59e0b">❶❷❸❹❺</span> 檢查點再抵達基地。用砲台築迷宮！';
  }
}

// ============================================================
// 4. A* 尋路
// ============================================================

class AStarNode {
  x: number; y: number; parent: AStarNode | null; g: number; h: number; f: number;
  constructor(x: number, y: number, parent: AStarNode | null, g: number, h: number) {
    this.x = x; this.y = y; this.parent = parent; this.g = g; this.h = h; this.f = g + h;
  }
}

function astarFind(start: Point, end: Point, isFlying: boolean = false, blockedX = -1, blockedY = -1): Point[] | null {
  if (isFlying) {
    const path: Point[] = [];
    let cx = start.x, cy = start.y;
    while (cx !== end.x || cy !== end.y) {
      path.push({ x: cx, y: cy });
      if (cx < end.x) cx++; else if (cx > end.x) cx--;
      if (cy < end.y) cy++; else if (cy > end.y) cy--;
    }
    path.push({ x: end.x, y: end.y });
    return path;
  }

  const openList: AStarNode[] = [];
  const closedSet = new Set<string>();
  const heuristic = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  openList.push(new AStarNode(start.x, start.y, null, 0, heuristic(start, end)));

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const cur = openList.shift()!;
    const key = `${cur.x},${cur.y}`;
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    if (cur.x === end.x && cur.y === end.y) {
      const path: Point[] = [];
      let n: AStarNode | null = cur;
      while (n) { path.push({ x: n.x, y: n.y }); n = n.parent; }
      return path.reverse();
    }

    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (grid[nx][ny] === 1 || (nx === blockedX && ny === blockedY)) continue;
      const nKey = `${nx},${ny}`;
      if (closedSet.has(nKey)) continue;
      const g = cur.g + 1;
      const h = heuristic({ x: nx, y: ny }, end);
      const existing = openList.find(n => n.x === nx && n.y === ny);
      if (!existing) {
        openList.push(new AStarNode(nx, ny, cur, g, h));
      } else if (g < existing.g) {
        existing.g = g; existing.f = g + existing.h; existing.parent = cur;
      }
    }
  }
  return null;
}

function validatePlacement(x: number, y: number): boolean {
  if (x === SPAWN_POINT.x && y === SPAWN_POINT.y) return false;
  if (x === BASE_POINT.x && y === BASE_POINT.y) return false;
  for (const wp of WAYPOINTS) { if (x === wp.x && y === wp.y) return false; }

  let tempStart = SPAWN_POINT;
  for (let i = 0; i <= WAYPOINTS.length; i++) {
    const target = i === WAYPOINTS.length ? BASE_POINT : WAYPOINTS[i];
    if (!astarFind(tempStart, target, false, x, y)) return false;
    tempStart = target;
  }
  for (const enemy of enemies) {
    if (enemy.isFlying) continue;
    const target = enemy.waypointIndex >= WAYPOINTS.length ? BASE_POINT : WAYPOINTS[enemy.waypointIndex];
    if (!astarFind({ x: enemy.currentGridX, y: enemy.currentGridY }, target, false, x, y)) return false;
  }
  return true;
}

function updateAllEnemyPaths() {
  for (const enemy of enemies) {
    if (enemy.isFlying) continue;
    const target = enemy.waypointIndex >= WAYPOINTS.length ? BASE_POINT : WAYPOINTS[enemy.waypointIndex];
    const path = astarFind({ x: enemy.currentGridX, y: enemy.currentGridY }, target);
    if (path) { enemy.path = path; enemy.pathIndex = 0; }
  }
}

// ============================================================
// 5. 砲台放置 / 拆除 / 合成
// ============================================================

canvas.addEventListener('click', (e) => {
  if (currentScene !== 'BATTLE') return;
  const rect = canvas.getBoundingClientRect();
  const gx = Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - rect.left) / TILE_SIZE)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor((e.clientY - rect.top) / TILE_SIZE)));

  if (mergeMode) {
    handleMergeClick(gx, gy);
    return;
  }

  if (selectedTool === 'sell') {
    handleSell(gx, gy);
    return;
  }

  // 放置砲台
  handleBuild(gx, gy);
});

// 右鍵快速售塔
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (currentScene !== 'BATTLE') return;
  const rect = canvas.getBoundingClientRect();
  const gx = Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - rect.left) / TILE_SIZE)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor((e.clientY - rect.top) / TILE_SIZE)));
  handleSell(gx, gy);
});

function handleBuild(x: number, y: number) {
  if (grid[x][y] !== 0) { showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '已有建物', '#ef4444', 15); return; }
  const def = BASE_TOWERS[selectedTool];
  if (!def) return;
  if (gold < def.cost) { showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '金幣不足', '#ef4444', 15); return; }

  if (def.isWall && !validatePlacement(x, y)) {
    showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '不能堵死怪物！', '#ef4444', 15);
    return;
  }

  grid[x][y] = def.isWall ? 1 : 0;
  towers.push({ id: nextTowerId++, x, y, typeId: def.id, def: { ...def }, cooldown: 0 });
  gold -= def.cost;
  updateUI();
  if (def.isWall) updateAllEnemyPaths();
}

function handleSell(x: number, y: number) {
  const idx = towers.findIndex(t => t.x === x && t.y === y);
  if (idx === -1) return;
  const tower = towers[idx];
  const refund = getSellPrice(tower.def);
  gold += refund;
  towers.splice(idx, 1);
  grid[x][y] = 0;
  updateUI();
  updateAllEnemyPaths();
  showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, `+${refund}g`, '#f59e0b');
}

function handleMergeClick(x: number, y: number) {
  const clickedTower = towers.find(t => t.x === x && t.y === y);
  if (!clickedTower) {
    showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '沒有砲台', '#ef4444', 15);
    return;
  }

  if (!mergeFirstTower) {
    // 選擇第一座塔
    mergeFirstTower = clickedTower;
    showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '已選取，請點擊另一座塔合成', '#c084fc', 15);
    return;
  }

  // 選擇第二座塔 — 檢查是否為同一座塔（取消選取）
  if (clickedTower.id === mergeFirstTower.id) {
    showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '已取消選取', '#94a3b8', 15);
    mergeFirstTower = null;
    return;
  }

  // 同系合成
  if (clickedTower.def.element === mergeFirstTower.def.element &&
      clickedTower.def.level === 1 && mergeFirstTower.def.level === 1) {
    const resultId = getSameMergeResult(clickedTower.def.element);
    if (resultId) {
      performMerge(mergeFirstTower, clickedTower, resultId);
      mergeFirstTower = null;
      return;
    }
  }

  // 異系配方合成
  const el1 = mergeFirstTower.def.element;
  const el2 = clickedTower.def.element;
  const recipeResult = getCrossRecipeResult(el1, el2);
  if (recipeResult) {
    // 陰陽合成需天賦
    if ((el1 === 'yin' || el1 === 'yang') && (el2 === 'yin' || el2 === 'yang')) {
      if ((talentData.talentLevels['taiji_dao'] || 0) < 1) {
        showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '需解鎖「太極之道」天賦', '#ef4444', 15);
        mergeFirstTower = null;
        return;
      }
    }
    performMerge(mergeFirstTower, clickedTower, recipeResult);
    mergeFirstTower = null;
    return;
  }

  showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '無法合成此組合', '#ef4444', 15);
  mergeFirstTower = null;
}

function performMerge(tower1: Tower, tower2: Tower, resultId: TowerTypeId) {
  const resultDef = getTowerDef(resultId);
  if (!resultDef) return;

  // 移除第二座塔
  const idx2 = towers.findIndex(t => t.id === tower2.id);
  if (idx2 !== -1) { towers.splice(idx2, 1); grid[tower2.x][tower2.y] = 0; }

  // 升級第一座塔
  tower1.typeId = resultId;
  tower1.def = { ...resultDef };
  tower1.cooldown = 0;

  updateAllEnemyPaths();
  showFloat(tower1.x * TILE_SIZE + 8, tower1.y * TILE_SIZE, `✨ ${resultDef.name}`, '#c084fc', 16);
}

// ============================================================
// 6. 波次系統
// ============================================================

const MAX_WAVES = 20; // 通關波次

btnStartWave.addEventListener('click', () => {
  if (isWaveActive || currentScene !== 'BATTLE') return;
  wave++;
  isWaveActive = true;
  updateUI();
  spawnWave(wave);
});

function spawnWave(waveNum: number) {
  const configs = getWaveConfig(waveNum);
  waveTotal = 0;
  waveSpawned = 0;

  for (const cfg of configs) waveTotal += cfg.count;

  for (const cfg of configs) {
    let spawned = 0;
    const timer = setInterval(() => {
      if (spawned >= cfg.count) { clearInterval(timer); return; }
      const def = ENEMY_DEFS[cfg.enemyType];
      const startPos = { ...SPAWN_POINT };
      const path = astarFind(startPos, WAYPOINTS[0], def.isFlying);
      if (path) {
        enemies.push({
          id: nextEnemyId++,
          type: cfg.enemyType,
          element: def.element,
          x: startPos.x * TILE_SIZE + TILE_SIZE / 2,
          y: startPos.y * TILE_SIZE + TILE_SIZE / 2,
          currentGridX: startPos.x, currentGridY: startPos.y,
          hp: Math.floor(def.baseHp * cfg.hpMultiplier),
          maxHp: Math.floor(def.baseHp * cfg.hpMultiplier),
          speed: def.speed,
          baseSpeed: def.speed,
          goldAward: def.goldAward,
          isFlying: def.isFlying,
          waypointIndex: 0,
          path, pathIndex: 0,
          slowDuration: 0,
          dotDamage: 0, dotDuration: 0
        });
      }
      spawned++;
      waveSpawned++;
    }, cfg.spawnIntervalMs);
    spawnTimers.push(timer);
  }
}

// ============================================================
// 7. 遊戲主迴圈
// ============================================================

function gameLoop() {
  if (currentScene !== 'BATTLE') return;
  updatePhysics();
  renderGame();
  animFrameId = requestAnimationFrame(gameLoop);
}

function updatePhysics() {
  const dmgMult = getDamageMultiplier(talentData);
  const frMult = getFireRateMultiplier(talentData);

  if (routePreviewTimer > 0) {
    routePreviewTimer--;
  }

  // 1. 怪物移動
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // DOT 傷害
    if (e.dotDuration > 0) {
      e.hp -= e.dotDamage;
      totalDamageDealt += e.dotDamage;
      e.dotDuration--;
      if (e.hp <= 0) {
        gold += e.goldAward;
        killCount++;
        currentKillStreak++;
        if (currentKillStreak > maxKillStreak) maxKillStreak = currentKillStreak;
        showFloat(e.x, e.y, `+${e.goldAward}g`, '#f59e0b');
        enemies.splice(i, 1);
        updateUI();
        checkWaveEnd();
        continue;
      }
    }

    // 減速
    if (e.slowDuration > 0) { e.slowDuration--; e.speed = e.baseSpeed * 0.4; }
    else { e.speed = e.baseSpeed; }

    if (e.path && e.pathIndex < e.path.length) {
      const tg = e.path[e.pathIndex];
      const tx = tg.x * TILE_SIZE + TILE_SIZE / 2;
      const ty = tg.y * TILE_SIZE + TILE_SIZE / 2;
      const dx = tx - e.x, dy = ty - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= e.speed) {
        e.x = tx; e.y = ty;
        e.currentGridX = tg.x; e.currentGridY = tg.y;
        e.pathIndex++;

        const curTarget = e.waypointIndex >= WAYPOINTS.length ? BASE_POINT : WAYPOINTS[e.waypointIndex];
        if (e.currentGridX === curTarget.x && e.currentGridY === curTarget.y) {
          e.waypointIndex++;
          if (e.waypointIndex > WAYPOINTS.length) {
            hp -= 1;
            enemies.splice(i, 1);
            updateUI();
            if (hp <= 0) { endBattle(false); return; }
            checkWaveEnd();
            continue;
          }
          const next = e.waypointIndex >= WAYPOINTS.length ? BASE_POINT : WAYPOINTS[e.waypointIndex];
          const np = astarFind({ x: e.currentGridX, y: e.currentGridY }, next, e.isFlying);
          if (np) { e.path = np; e.pathIndex = 0; }
        }
      } else {
        e.x += (dx / dist) * e.speed;
        e.y += (dy / dist) * e.speed;
      }
    }
  }

  // 2. 砲台射擊
  for (const tower of towers) {
    if (tower.def.damage === 0 && !tower.def.buffAllyDmg) continue;

    // 鍛造塔 buff 效果（被動，不射擊）
    if (tower.def.buffAllyDmg) continue; // buff 在傷害計算時即時查詢

    if (tower.cooldown > 0) { tower.cooldown--; continue; }

    const tx = tower.x * TILE_SIZE + TILE_SIZE / 2;
    const ty = tower.y * TILE_SIZE + TILE_SIZE / 2;
    let best: Enemy | null = null;
    let minDist = Infinity;

    for (const e of enemies) {
      const d = Math.sqrt((e.x - tx) ** 2 + (e.y - ty) ** 2) / TILE_SIZE;
      if (d <= tower.def.range && d < minDist) { minDist = d; best = e; }
    }

    if (best) {
      // 計算傷害（含天賦倍率、五行屬性強化、鍛造塔 buff）
      let finalDmg = tower.def.damage * dmgMult * getTowerElementDamageMultiplier(talentData, tower.def.element);
      // 鍛造塔附近 buff 檢查
      for (const bt of towers) {
        if (!bt.def.buffAllyDmg) continue;
        const bdist = Math.abs(bt.x - tower.x) + Math.abs(bt.y - tower.y);
        if (bdist <= (bt.def.buffAllyRange ?? 2)) {
          finalDmg *= (1 + bt.def.buffAllyDmg);
        }
      }

      bullets.push({
        x: tx, y: ty,
        targetEnemy: best,
        speed: 6,
        damage: Math.floor(finalDmg),
        element: tower.def.element,
        slowPct: tower.def.slowPct,
        slowDuration: tower.def.slowDuration,
        dotDamage: tower.def.dotDamage,
        dotDuration: tower.def.dotDuration,
        aoeRadius: tower.def.aoeRadius,
        aoeDamagePct: tower.def.aoeDamagePct,
        hpPctDamage: tower.def.hpPctDamage,
        critChance: tower.def.critChance,
        critMultiplier: tower.def.critMultiplier,
        flyingBonus: tower.def.flyingBonus,
        healBase: tower.def.healBase,
        spawnWall: tower.def.spawnWall,
      });

      tower.cooldown = Math.floor(tower.def.fireRate * frMult);
    }
  }

  // 3. 子彈移動與擊中
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const alive = enemies.some(e => e.id === b.targetEnemy.id);

    const targetX = alive ? b.targetEnemy.x : b.targetEnemy.x;
    const targetY = alive ? b.targetEnemy.y : b.targetEnemy.y;
    const dx = targetX - b.x, dy = targetY - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= b.speed || !alive) {
      if (!alive) { bullets.splice(i, 1); continue; }

      // 擊中處理
      let dmg = b.damage;

      // 五行相剋加成
      dmg = Math.floor(dmg * getElementBonus(b.element, b.targetEnemy.element));

      // 暴擊
      if (b.critChance && Math.random() < b.critChance) {
        dmg = Math.floor(dmg * (b.critMultiplier ?? 2));
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 14, '暴擊!', '#fde047');
      }

      // 飛行加成
      if (b.flyingBonus && b.targetEnemy.isFlying) {
        dmg = Math.floor(dmg * (1 + b.flyingBonus));
      }

      // % 血量傷害
      if (b.hpPctDamage) {
        dmg += Math.floor(b.targetEnemy.maxHp * b.hpPctDamage);
      }

      b.targetEnemy.hp -= dmg;
      totalDamageDealt += dmg;
      showFloat(b.targetEnemy.x, b.targetEnemy.y - 10, `-${dmg}`, '#ef4444');

      // 減速效果
      if (b.slowPct && b.slowDuration) {
        b.targetEnemy.slowDuration = Math.max(b.targetEnemy.slowDuration, b.slowDuration);
      }

      // DOT 效果
      if (b.dotDamage && b.dotDuration) {
        b.targetEnemy.dotDamage = b.dotDamage;
        b.targetEnemy.dotDuration = Math.max(b.targetEnemy.dotDuration, b.dotDuration);
      }

      // AOE 傷害
      if (b.aoeRadius && b.aoeDamagePct) {
        const aoeDmg = Math.floor(dmg * b.aoeDamagePct);
        const aoeRange = b.aoeRadius * TILE_SIZE;
        for (const e of enemies) {
          if (e.id === b.targetEnemy.id) continue;
          const adist = Math.sqrt((e.x - b.targetEnemy.x) ** 2 + (e.y - b.targetEnemy.y) ** 2);
          if (adist <= aoeRange) {
            e.hp -= aoeDmg;
            totalDamageDealt += aoeDmg;
            showFloat(e.x, e.y - 10, `-${aoeDmg}`, '#f97316');
          }
        }
      }

      // 治療基地
      if (b.healBase) {
        hp = Math.min(getBaseHP(talentData), hp + b.healBase);
      }

      // 靈木塔：生成臨時障礙（在怪物當前格，持續 5 秒）
      if (b.spawnWall) {
        const wx = b.targetEnemy.currentGridX;
        const wy = b.targetEnemy.currentGridY;
        const isFreeCell = grid[wx][wy] === 0 && !tempWalls.some(w => w.x === wx && w.y === wy);
        if (isFreeCell && validatePlacement(wx, wy)) {
          grid[wx][wy] = 1;
          tempWalls.push({ x: wx, y: wy, lifetime: 300 }); // 5秒 (300幀)
          updateAllEnemyPaths();
          showFloat(b.targetEnemy.x, b.targetEnemy.y - 16, '🌿 纏縛！', '#4ade80', 13);
        }
      }

      // 檢查目標死亡
      if (b.targetEnemy.hp <= 0) {
        const eidx = enemies.findIndex(e => e.id === b.targetEnemy.id);
        if (eidx !== -1) {
          gold += b.targetEnemy.goldAward;
          killCount++;
          currentKillStreak++;
          if (currentKillStreak > maxKillStreak) maxKillStreak = currentKillStreak;
          showFloat(b.targetEnemy.x, b.targetEnemy.y, `+${b.targetEnemy.goldAward}g`, '#f59e0b');
          enemies.splice(eidx, 1);
          updateUI();
          checkWaveEnd();
        }
      }

      // 檢查 AOE 造成的死亡
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (enemies[j].hp <= 0) {
          gold += enemies[j].goldAward;
          killCount++;
          showFloat(enemies[j].x, enemies[j].y, `+${enemies[j].goldAward}g`, '#f59e0b');
          enemies.splice(j, 1);
          updateUI();
        }
      }
      checkWaveEnd();

      bullets.splice(i, 1);
    } else {
      b.x += (dx / dist) * b.speed;
      b.y += (dy / dist) * b.speed;
    }
  }

  // 4. 飄字
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y -= 0.5; ft.life--; ft.alpha = ft.life / 45;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // 5. 臨時障礙倒計時
  for (let i = tempWalls.length - 1; i >= 0; i--) {
    tempWalls[i].lifetime--;
    if (tempWalls[i].lifetime <= 0) {
      const tw = tempWalls[i];
      grid[tw.x][tw.y] = 0;
      tempWalls.splice(i, 1);
      updateAllEnemyPaths();
    }
  }
}

// ============================================================
// 8. 結算
// ============================================================

function endBattle(isVictory: boolean) {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  spawnTimers.forEach(t => clearInterval(t));
  spawnTimers = [];

  const earned = calcTalentPointsEarned(wave);
  addTalentPoints(talentData, earned);

  const titleEl = document.getElementById('gameoverTitle')!;
  titleEl.textContent = isVictory ? '🎉 防禦成功！' : '💀 防禦失敗';
  titleEl.className = `gameover-title ${isVictory ? 'victory' : 'defeat'}`;

  document.getElementById('goWaveVal')!.textContent = wave.toString();
  document.getElementById('goKillVal')!.textContent = killCount.toString();
  document.getElementById('goTalentVal')!.textContent = `+${earned}`;
  document.getElementById('goDamageVal')!.textContent = totalDamageDealt.toLocaleString();
  document.getElementById('goStreakVal')!.textContent = maxKillStreak.toString();

  switchScene('GAME_OVER');
}

function checkWaveEnd() {
  if (enemies.length === 0 && isWaveActive) {
    isWaveActive = false;
    currentKillStreak = 0; // 波次間重置連殺計數
    showFloat(640, 320, '波次防禦成功！', '#10b981');
    gold += 15 + wave * 3;
    updateUI();
    // 達到最大波次則勝利
    if (wave >= MAX_WAVES) {
      setTimeout(() => endBattle(true), 1500);
    } else {
      // 禁止超過最大波次
      btnStartWave.disabled = wave >= MAX_WAVES;
    }
  }
}

// ============================================================
// 9. 渲染
// ============================================================

function renderGame() {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 網格線
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * TILE_SIZE, 0); ctx.lineTo(x * TILE_SIZE, canvas.height); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE_SIZE); ctx.lineTo(canvas.width, y * TILE_SIZE); ctx.stroke(); }

  // 起點 / 終點
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(SPAWN_POINT.x * TILE_SIZE, SPAWN_POINT.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(BASE_POINT.x * TILE_SIZE, BASE_POINT.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

  // 檢查點
  WAYPOINTS.forEach((wp, idx) => {
    ctx.beginPath();
    ctx.arc(wp.x * TILE_SIZE + TILE_SIZE / 2, wp.y * TILE_SIZE + TILE_SIZE / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((idx + 1).toString(), wp.x * TILE_SIZE + TILE_SIZE / 2, wp.y * TILE_SIZE + TILE_SIZE / 2);
  });

  // 砲台（使用像素精靈）
  for (const t of towers) {
    drawTowerSprite(ctx, t.typeId, t.x * TILE_SIZE, t.y * TILE_SIZE);

    // 合成模式高亮選中的第一座塔
    if (mergeMode && mergeFirstTower && mergeFirstTower.id === t.id) {
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2;
      ctx.strokeRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // 臨時障礙（靈木塔效果）
  for (const tw of tempWalls) {
    ctx.save();
    const alpha = Math.min(1, tw.lifetime / 60); // 最後 1 秒漸隱
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(tw.x * TILE_SIZE, tw.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1;
    ctx.strokeRect(tw.x * TILE_SIZE, tw.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  // 怪物（使用像素精靈）
  for (const e of enemies) {
    drawEnemySprite(ctx, e.type, e.x, e.y);

    // 血條
    const hpPct = e.hp / e.maxHp;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(e.x - 8, e.y - 12, 16, 3);
    ctx.fillStyle = e.slowDuration > 0 ? '#06b6d4' : '#10b981';
    ctx.fillRect(e.x - 8, e.y - 12, 16 * hpPct, 3);

    // DOT 指示
    if (e.dotDuration > 0) {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(e.x - 8, e.y - 9, 16 * (e.dotDuration / 60), 1);
    }
  }

  // 子彈
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    // 根據屬性著色
    const bulletColors: Record<string, string> = {
      fire: '#f97316', water: '#38bdf8', wood: '#4ade80',
      earth: '#d97706', metal: '#e5e7eb', yin: '#a855f7', yang: '#fde047'
    };
    ctx.fillStyle = bulletColors[b.element] ?? '#facc15';
    ctx.fill();
  }

  // 飄字
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    const fSize = ft.fontSize || 11;
    ctx.font = `bold ${fSize}px Outfit, sans-serif`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  if (routePreviewTimer > 0) {
    drawRoutePreview();
  }
}

// ============================================================
// 10. UI 工具函數
// ============================================================

function drawRoutePreview() {
  if (cachedPreviewRoute.length === 0) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 路線被完全阻塞！無法通往基地', canvas.width / 2, canvas.height / 2);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#38bdf8';

  if (routePreviewTimer < 60) {
    ctx.globalAlpha = routePreviewTimer / 60;
  } else {
    ctx.globalAlpha = 1.0;
  }

  ctx.beginPath();
  const startX = cachedPreviewRoute[0].x * TILE_SIZE + TILE_SIZE / 2;
  const startY = cachedPreviewRoute[0].y * TILE_SIZE + TILE_SIZE / 2;
  ctx.moveTo(startX, startY);

  for (let i = 1; i < cachedPreviewRoute.length; i++) {
    const tx = cachedPreviewRoute[i].x * TILE_SIZE + TILE_SIZE / 2;
    const ty = cachedPreviewRoute[i].y * TILE_SIZE + TILE_SIZE / 2;
    ctx.lineTo(tx, ty);
  }
  ctx.stroke();

  // 繪製發光虛線流動點效果
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.setLineDash([6, 12]);
  ctx.lineDashOffset = -routePreviewTimer * 1.5;
  ctx.stroke();
  ctx.restore();
}

function showFloat(x: number, y: number, text: string, color: string, fontSize?: number) {
  floatingTexts.push({ x, y, text, color, alpha: 1.0, life: 45, fontSize });
}

function updateUI() {
  hpVal.textContent = Math.floor(hp).toString();
  goldVal.textContent = gold.toString();
  waveVal.textContent = wave.toString();
  killVal.textContent = killCount.toString();
  btnStartWave.disabled = isWaveActive || wave >= MAX_WAVES;
  updateWaveProgress();
}

function updateWaveProgress() {
  if (!isWaveActive) {
    waveProgressLabel.textContent = '待機中';
    waveEnemyCount.textContent = '';
    waveProgressFill.style.width = '0%';
    waveProgressFill.classList.add('idle');
    return;
  }
  waveProgressFill.classList.remove('idle');
  const alive = enemies.length;
  // remaining = 已生成中還活著的 + 尚未生成的 (waveTotal - waveSpawned)
  const remaining = alive + Math.max(0, waveTotal - waveSpawned);
  const pct = waveTotal > 0 ? (1 - remaining / waveTotal) * 100 : 100;
  waveProgressFill.style.width = `${Math.min(100, pct)}%`;
  waveProgressLabel.textContent = `波次 ${wave} 進行中`;
  waveEnemyCount.textContent = remaining > 0 ? `剩餘 ${remaining} 隻` : '即將結束...';
}

// ============================================================
// 11. 事件綁定與初始化
// ============================================================

// 主介面按鈕
document.getElementById('btnStartGame')!.addEventListener('click', () => switchScene('BATTLE'));
document.getElementById('btnTalent')!.addEventListener('click', () => switchScene('TALENT_SCREEN'));
document.getElementById('btnBackFromTalent')!.addEventListener('click', () => switchScene('MAIN_MENU'));
document.getElementById('btnBackToMenu')!.addEventListener('click', () => switchScene('MAIN_MENU'));
document.getElementById('btnResetTalents')!.addEventListener('click', () => {
  if (confirm('確定要重置所有天賦嗎？已花費的天賦點將全部退回。')) {
    resetTalents(talentData);
    renderTalentScreen();
  }
});

// 戰鬥場景按鈕
btnMerge.addEventListener('click', () => {
  mergeMode = !mergeMode;
  mergeFirstTower = null;
  if (mergeMode) selectedTool = '';
  refreshToolSelection();
});
btnSell.addEventListener('click', () => {
  mergeMode = false; mergeFirstTower = null;
  selectedTool = 'sell';
  refreshToolSelection();
});
btnQuitBattle.addEventListener('click', () => {
  if (confirm('確定放棄本局嗎？將進行天賦結算。')) {
    endBattle(false);
  }
});

btnShowRoute.addEventListener('click', () => {
  let fullPath: Point[] = [];
  let currentStart = SPAWN_POINT;
  const targets = [...WAYPOINTS, BASE_POINT];
  let blocked = false;
  
  for (const target of targets) {
    const segment = astarFind(currentStart, target, false);
    if (segment) {
      if (fullPath.length > 0) {
        fullPath = fullPath.concat(segment.slice(1));
      } else {
        fullPath = fullPath.concat(segment);
      }
      currentStart = target;
    } else {
      blocked = true;
      break;
    }
  }

  if (blocked) {
    cachedPreviewRoute = [];
  } else {
    cachedPreviewRoute = fullPath;
  }
  routePreviewTimer = 180; // 3 秒
});

// 初始化
talentData = loadTalentData();
initSprites();
refreshMenuTalentInfo();
