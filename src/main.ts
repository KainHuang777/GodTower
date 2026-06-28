// ============================================================
// src/main.ts — 五行迷宮塔防 核心遊戲邏輯
// ============================================================

import { BASE_TOWERS, getTowerDef, getSameMergeResult, getCrossRecipeResult, getElementBonus, getSellPrice, type TowerDef, type TowerTypeId, type Element } from './towers';
import { ENEMY_DEFS, getWaveConfig, type EnemyTypeId } from './enemies';
import { loadTalentData, getAvailablePoints, canUnlockTalent, unlockTalent, calcTalentPointsEarned, addTalentPoints, getBaseHP, getStartGold, getDamageMultiplier, getTowerElementDamageMultiplier, getFireRateMultiplier, isTowerUnlocked, resetTalents, TALENT_TREE, getWallCost, type TalentSaveData, type TalentId } from './talent';
import { initSprites, drawEnemySprite, drawTowerSprite, preloadImage, drawTile, spriteCache } from './sprites';
import { MAPS, loadCustomMaps, saveCustomMaps, deleteCustomMap, type MapConfig } from './maps';
import releaseNotesText from '../Releasenote.md?raw';

// --- 常數 (在此改為可變動，以適應測試關卡放大) ---
let COLS = 80;
let ROWS = 40;
let TILE_SIZE = 16;

interface Point { x: number; y: number; }

// --- 遊戲地圖變數 ---
let currentMap: MapConfig = MAPS[1]; // 預設為簡單關卡
let SPAWN_POINT: Point = { x: 0, y: 20 };
let BASE_POINT: Point = { x: 79, y: 20 };
let WAYPOINTS: Point[] = [
  { x: 13, y: 8 }, { x: 26, y: 32 }, { x: 40, y: 8 }, { x: 53, y: 32 }, { x: 66, y: 15 }
];

// --- 場景管理 ---
type GameScene = 'MAIN_MENU' | 'LEVEL_SELECT' | 'MAP_EDITOR' | 'TALENT_SCREEN' | 'BATTLE' | 'GAME_OVER';
let currentScene: GameScene = 'MAIN_MENU';
let animFrameId: number | null = null;

// --- 地圖編輯器狀態 ---
type EditorTool = 'spawn' | 'base' | 'waypoint' | 'obstacle' | 'eraser';
let editorTool: EditorTool = 'obstacle';
let editorGrid: number[][] = [];
let editorSpawn: Point | null = null;
let editorBase: Point | null = null;
let editorWaypoints: Point[] = [];
let editorAnimId: number | null = null;
let editorMouseDown = false;

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
let grid: number[][] = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
let currentStyle: 'pixel' | 'highres' = 'pixel';

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
  hitFlashFrame: number; // 剩餘受擊閃爍幀數
  vx: number;
  vy: number;
  squashX: number;
  squashY: number;
}

interface Tower {
  id: number;
  x: number; y: number;
  typeId: TowerTypeId;
  def: TowerDef;
  cooldown: number;
  recoilY: number;
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
let drawCallCount = 0;
let isDiagnosticOpen = false;
let lastFpsUpdateTime = 0;
let frameCount = 0;
let currentFps = 60;
let towers: Tower[] = [];
let bullets: Bullet[] = [];
let floatingTexts: FloatingText[] = [];
let tempWalls: TempWall[] = [];
let nextEnemyId = 1;

// --- 粒子特效系統介面與變數 (Phase 4) ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  gravity?: number;
  isPixel?: boolean;
  dragMultiplier?: number;
  isRing?: boolean;
  maxRadius?: number;
}
let particles: Particle[] = [];
let nextTowerId = 1;
let selectedTool: string = 'earth'; // 預設選擇岩壁塔
let mergeMode = false;
let mergeFirstTower: Tower | null = null;
let spawnTimers: ReturnType<typeof setInterval>[] = [];
let routePreviewTimer = 0;
let cachedPreviewRoute: Point[] = [];

// --- 地圖主題與動態天氣變數 (Phase 4) ---
type ThemeId = 'scifi' | 'chinese' | 'ink' | 'starry';
type WeatherId = 'none' | 'rain' | 'fog' | 'thunder';

let currentTheme: ThemeId = 'scifi';
let currentWeather: WeatherId = 'none';

interface BgStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
}
let bgStars: BgStar[] = [];

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  length?: number;
}
let weatherParticles: WeatherParticle[] = [];
let lightningTimer = 0;
let lightningActive = 0; // > 0 表示閃電亮起幀數
let lightningPaths: Point[][] = [];

// --- 地圖平移與縮放變數 (Phase 4) ---
let mapScale = 1.0;
let mapOffsetX = 0;
let mapOffsetY = 0;
let isDraggingMap = false;
let isPointerDown = false;
let startPointerX = 0;
let startPointerY = 0;
const dragThreshold = 5;
let lastTouchDist = 0;

// --- 背景音樂播放控制變數 (Phase 4) ---
const BGM_PLAYLIST = [
  'assets/audio/Rain_on_the_Pagoda_Roof.mp3',
  'assets/audio/Tiles_in_Motion.mp3',
  'assets/audio/Iron_River_Gate.mp3'
];
let currentBgmIndex = 0;
let bgmAudio: HTMLAudioElement | null = null;
let bgmTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isMusicEnabled = true;
let hasUserInteracted = false;


// --- 波次進度追蹤 ---
let waveTotal = 0;    // 本波應生成總怪物數
let waveSpawned = 0;  // 本波已生成怪物數

const GAME_VERSION = 'V0.30';

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
const btnDiagnostics = document.getElementById('btnDiagnostics')!;
const diagnosticPanel = document.getElementById('diagnosticPanel')!;
const btnDiagExport = document.getElementById('btnDiagExport')!;
const diagFps = document.getElementById('diagFps')!;
const diagLatency = document.getElementById('diagLatency')!;
const diagDrawCalls = document.getElementById('diagDrawCalls')!;
const diagCacheSize = document.getElementById('diagCacheSize')!;
const diagMonsters = document.getElementById('diagMonsters')!;
const diagTowers = document.getElementById('diagTowers')!;
const diagFilterWarning = document.getElementById('diagFilterWarning')!;
const btnShowRoute = document.getElementById('btnShowRoute')!;
const instructionText = document.getElementById('instructionText')!;
const towerButtonsContainer = document.getElementById('towerButtons')!;
const waveProgressFill = document.getElementById('waveProgressFill')!;
const waveProgressLabel = document.getElementById('waveProgressLabel')!;
const waveEnemyCount = document.getElementById('waveEnemyCount')!;
const selectTheme = document.getElementById('selectTheme') as HTMLSelectElement;
const selectWeather = document.getElementById('selectWeather') as HTMLSelectElement;
const selectStyle = document.getElementById('selectStyle') as HTMLSelectElement;

// 場景元素
const mainMenuEl = document.getElementById('mainMenu')!;
const levelSelectScreenEl = document.getElementById('levelSelectScreen')!;
const levelGridEl = document.getElementById('levelGrid')!;
const mapEditorSceneEl = document.getElementById('mapEditorScene')!;
const editorCanvasEl = document.getElementById('editorCanvas') as HTMLCanvasElement;
const editorCtx = editorCanvasEl.getContext('2d')!;
const editorStatusEl = document.getElementById('editorStatus')!;
const editorMapNameInput = document.getElementById('editorMapName') as HTMLInputElement;
const talentScreenEl = document.getElementById('talentScreen')!;
const gameOverScreenEl = document.getElementById('gameOverScreen')!;
const battleSceneEl = document.getElementById('battleScene')!;

// ============================================================
// 1. 場景切換
// ============================================================

function switchScene(scene: GameScene) {
  currentScene = scene;
  mainMenuEl.classList.remove('active');
  levelSelectScreenEl.classList.remove('active');
  mapEditorSceneEl.classList.remove('active');
  talentScreenEl.classList.remove('active');
  gameOverScreenEl.classList.remove('active');
  battleSceneEl.classList.remove('active');

  // 離開編輯器時停止其渲染迴圈
  if (scene !== 'MAP_EDITOR' && editorAnimId) {
    cancelAnimationFrame(editorAnimId);
    editorAnimId = null;
  }

  switch (scene) {
    case 'MAIN_MENU':
      mainMenuEl.classList.add('active');
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      refreshMenuTalentInfo();
      break;
    case 'LEVEL_SELECT':
      levelSelectScreenEl.classList.add('active');
      renderLevelSelectScreen();
      break;
    case 'MAP_EDITOR':
      mapEditorSceneEl.classList.add('active');
      initEditor();
      break;
    case 'TALENT_SCREEN':
      talentScreenEl.classList.add('active');
      renderTalentScreen();
      break;
    case 'BATTLE':
      battleSceneEl.classList.add('active');
      startBattle();
      if (currentMap && currentMap.id === 'test_level') {
        mapScale = 1.0;
        mapOffsetX = 0;
        mapOffsetY = 0;
      } else {
        mapScale = 2.0; // 2x zoom for large maps
        mapOffsetX = 0; // Align left
        mapOffsetY = -320; // Center Y-axis vertically
      }
      resizeGameContainer();
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

function renderLevelSelectScreen() {
  levelGridEl.innerHTML = '';
  const allMaps = [...MAPS, ...loadCustomMaps()];
  allMaps.forEach(map => {
    const card = document.createElement('div');
    card.className = 'level-card';
    
    let badgeClass = 'badge-easy';
    if (map.difficulty === '教學') badgeClass = 'badge-tutorial';
    else if (map.difficulty === '中等') badgeClass = 'badge-normal';
    else if (map.difficulty === '困難') badgeClass = 'badge-hard';
    else if (map.difficulty === '自訂') badgeClass = 'badge-custom';
    else if (map.difficulty === '測試') badgeClass = 'badge-test';
    
    const isCustom = map.difficulty === '自訂';
    card.innerHTML = `
      <span class="level-badge ${badgeClass}">${map.difficulty}</span>
      <div class="level-title">${map.name}</div>
      <div class="level-desc">${map.description}</div>
      <div class="level-info">
        📍 起點: (${map.spawnPoint.x}, ${map.spawnPoint.y}) &nbsp;&nbsp; 
        🏠 終點: (${map.basePoint.x}, ${map.basePoint.y}) <br>
        🏁 檢查點: ${map.waypoints.length} 個 &nbsp;&nbsp;
        ⛰️ 障礙物: ${map.obstacles.length} 個
      </div>
      ${isCustom ? '<div class="level-card-actions"><button class="btn-delete" data-delete-map="' + map.id + '">🗑️ 刪除</button></div>' : ''}
    `;
    
    card.addEventListener('click', (e) => {
      // 防止點擊刪除按鈕時觸發卡片點擊
      if ((e.target as HTMLElement).hasAttribute('data-delete-map')) return;
      playSFX('click');
      currentMap = map;
      switchScene('BATTLE');
    });

    // 自訂地圖的刪除按鈕
    if (isCustom) {
      const delBtn = card.querySelector('.btn-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`確定要刪除自訂地圖「${map.name}」嗎？`)) {
            deleteCustomMap(map.id);
            renderLevelSelectScreen(); // 重新渲染列表
          }
        });
      }
    }
    
    levelGridEl.appendChild(card);
  });
}

// ============================================================
// 1.5 地圖編輯器
// ============================================================

function initEditor() {
  editorGrid = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
  editorSpawn = null;
  editorBase = null;
  editorWaypoints = [];
  editorTool = 'obstacle';
  editorMapNameInput.value = '';
  editorMouseDown = false;
  
  // 重設工具按鈕高亮
  document.querySelectorAll('[data-editor-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-editor-tool') === 'obstacle');
  });
  
  updateEditorStatus();
  startEditorLoop();
}

function startEditorLoop() {
  if (editorAnimId) cancelAnimationFrame(editorAnimId);
  function loop() {
    if (currentScene !== 'MAP_EDITOR') return;
    renderEditor();
    editorAnimId = requestAnimationFrame(loop);
  }
  editorAnimId = requestAnimationFrame(loop);
}

function renderEditor() {
  const ctx = editorCtx;
  const W = editorCanvasEl.width;
  const H = editorCanvasEl.height;
  
  // 背景
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, W, H);

  // 網格線
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * TILE_SIZE, 0); ctx.lineTo(x * TILE_SIZE, ROWS * TILE_SIZE); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE_SIZE); ctx.lineTo(COLS * TILE_SIZE, y * TILE_SIZE); ctx.stroke(); }

  // 障礙物
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (editorGrid[x][y] === 2) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      }
    }
  }

  // 起點
  if (editorSpawn) {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(editorSpawn.x * TILE_SIZE, editorSpawn.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S', editorSpawn.x * TILE_SIZE + TILE_SIZE / 2, editorSpawn.y * TILE_SIZE + TILE_SIZE / 2);
  }

  // 終點
  if (editorBase) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(editorBase.x * TILE_SIZE, editorBase.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('B', editorBase.x * TILE_SIZE + TILE_SIZE / 2, editorBase.y * TILE_SIZE + TILE_SIZE / 2);
  }

  // 檢查點
  editorWaypoints.forEach((wp, idx) => {
    ctx.beginPath();
    ctx.arc(wp.x * TILE_SIZE + TILE_SIZE / 2, wp.y * TILE_SIZE + TILE_SIZE / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((idx + 1).toString(), wp.x * TILE_SIZE + TILE_SIZE / 2, wp.y * TILE_SIZE + TILE_SIZE / 2);
  });

  // 當前工具提示（左上角）
  const toolNames: Record<EditorTool, string> = {
    spawn: '📍 起點', base: '🏠 終點', waypoint: '🏁 檢查點',
    obstacle: '⛰️ 障礙物', eraser: '🧹 橡皮擦'
  };
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(4, 4, 130, 22);
  ctx.fillStyle = '#e2e8f0'; ctx.font = '12px Outfit, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`工具: ${toolNames[editorTool]}`, 10, 9);
}

function editorClickAt(gx: number, gy: number, isRightClick: boolean) {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

  if (isRightClick) {
    // 右鍵：在 waypoint 模式下刪除檢查點；在 obstacle 模式下擦除障礙物
    const wpIdx = editorWaypoints.findIndex(w => w.x === gx && w.y === gy);
    if (wpIdx !== -1) {
      editorWaypoints.splice(wpIdx, 1);
    } else if (editorGrid[gx][gy] === 2) {
      editorGrid[gx][gy] = 0;
    }
    updateEditorStatus();
    return;
  }

  // 左鍵操作
  switch (editorTool) {
    case 'spawn':
      // 清除舊起點格子
      if (editorSpawn && editorGrid[editorSpawn.x]?.[editorSpawn.y] === 2) {
        // 不清除障礙物
      }
      editorSpawn = { x: gx, y: gy };
      editorGrid[gx][gy] = 0; // 確保起點不在障礙上
      break;
    case 'base':
      editorBase = { x: gx, y: gy };
      editorGrid[gx][gy] = 0;
      break;
    case 'waypoint':
      // 不重複放置
      if (editorWaypoints.some(w => w.x === gx && w.y === gy)) break;
      if (editorWaypoints.length >= 8) break;
      editorGrid[gx][gy] = 0;
      editorWaypoints.push({ x: gx, y: gy });
      break;
    case 'obstacle':
      // 不覆蓋起終點和檢查點
      if (editorSpawn && editorSpawn.x === gx && editorSpawn.y === gy) break;
      if (editorBase && editorBase.x === gx && editorBase.y === gy) break;
      if (editorWaypoints.some(w => w.x === gx && w.y === gy)) break;
      editorGrid[gx][gy] = 2;
      break;
    case 'eraser':
      editorGrid[gx][gy] = 0;
      if (editorSpawn && editorSpawn.x === gx && editorSpawn.y === gy) editorSpawn = null;
      if (editorBase && editorBase.x === gx && editorBase.y === gy) editorBase = null;
      const ewIdx = editorWaypoints.findIndex(w => w.x === gx && w.y === gy);
      if (ewIdx !== -1) editorWaypoints.splice(ewIdx, 1);
      break;
  }
  updateEditorStatus();
}

function updateEditorStatus() {
  const parts: string[] = [];
  parts.push(editorSpawn ? `<span class="status-ok">📍 起點 ✔</span>` : `<span class="status-warn">📍 起點 ✘</span>`);
  parts.push(editorBase ? `<span class="status-ok">🏠 終點 ✔</span>` : `<span class="status-warn">🏠 終點 ✘</span>`);
  parts.push(editorWaypoints.length > 0
    ? `<span class="status-ok">🏁 檢查點: ${editorWaypoints.length} 個</span>`
    : `<span class="status-warn">🏁 檢查點: 0 個（至少 1 個）</span>`);
  
  let obsCnt = 0;
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if (editorGrid[x]?.[y] === 2) obsCnt++;
  parts.push(`⛰️ 障礙物: ${obsCnt} 個`);
  editorStatusEl.innerHTML = parts.join(' &nbsp;|&nbsp; ');
}

function editorValidatePath(): boolean {
  if (!editorSpawn || !editorBase || editorWaypoints.length === 0) return false;

  // 暫時將 grid 設為 editorGrid 的值來做 A* 驗證
  const backupGrid = grid.map(col => [...col]);
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) grid[x][y] = editorGrid[x]?.[y] || 0;
  
  let valid = true;
  let prev = editorSpawn;
  for (let i = 0; i <= editorWaypoints.length; i++) {
    const target = i === editorWaypoints.length ? editorBase : editorWaypoints[i];
    if (!astarFind(prev, target)) { valid = false; break; }
    prev = target;
  }

  // 還原 grid
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) grid[x][y] = backupGrid[x][y];
  return valid;
}

function editorSave() {
  const name = editorMapNameInput.value.trim();
  if (!name) { alert('請輸入地圖名稱！'); return; }
  if (!editorSpawn) { alert('請設定起點！'); return; }
  if (!editorBase) { alert('請設定終點！'); return; }
  if (editorWaypoints.length === 0) { alert('請至少設定 1 個檢查點！'); return; }
  if (!editorValidatePath()) {
    alert('路徑驗證失敗！怪物無法從起點經過所有檢查點到達終點，請調整障礙物位置。');
    return;
  }

  const obstacles: { x: number; y: number }[] = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (editorGrid[x]?.[y] === 2) obstacles.push({ x, y });
    }
  }

  const newMap: MapConfig = {
    id: `custom_${Date.now()}`,
    name,
    difficulty: '自訂',
    description: `玩家自建地圖：${editorWaypoints.length} 個檢查點、${obstacles.length} 個障礙物。`,
    spawnPoint: { ...editorSpawn },
    basePoint: { ...editorBase },
    waypoints: editorWaypoints.map(w => ({ ...w })),
    obstacles
  };

  const existing = loadCustomMaps();
  existing.push(newMap);
  saveCustomMaps(existing);
  alert(`地圖「${name}」已儲存！`);
  switchScene('LEVEL_SELECT');
}

// 編輯器 Canvas 事件綁定
editorCanvasEl.addEventListener('mousedown', (e) => {
  if (currentScene !== 'MAP_EDITOR') return;
  e.preventDefault();
  editorMouseDown = true;
  const rect = editorCanvasEl.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (editorCanvasEl.width / rect.width);
  const clickY = (e.clientY - rect.top) * (editorCanvasEl.height / rect.height);
  const gx = Math.floor(clickX / TILE_SIZE);
  const gy = Math.floor(clickY / TILE_SIZE);
  editorClickAt(gx, gy, e.button === 2);
});

editorCanvasEl.addEventListener('mousemove', (e) => {
  if (currentScene !== 'MAP_EDITOR' || !editorMouseDown) return;
  if (editorTool !== 'obstacle' && editorTool !== 'eraser') return; // 只有障礙物和橡皮擦支持拖曳繪製
  const rect = editorCanvasEl.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (editorCanvasEl.width / rect.width);
  const clickY = (e.clientY - rect.top) * (editorCanvasEl.height / rect.height);
  const gx = Math.floor(clickX / TILE_SIZE);
  const gy = Math.floor(clickY / TILE_SIZE);
  editorClickAt(gx, gy, false);
});

editorCanvasEl.addEventListener('mouseup', () => { editorMouseDown = false; });
editorCanvasEl.addEventListener('mouseleave', () => { editorMouseDown = false; });
editorCanvasEl.addEventListener('contextmenu', (e) => { e.preventDefault(); });

// 編輯器工具列按鈕切換
document.querySelectorAll<HTMLButtonElement>('[data-editor-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.getAttribute('data-editor-tool') as EditorTool;
    if (!tool) return;
    editorTool = tool;
    document.querySelectorAll('[data-editor-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// 編輯器動作按鈕
document.getElementById('btnEditorValidate')!.addEventListener('click', () => {
  if (editorValidatePath()) {
    alert('✅ 路徑驗證通過！怪物可以從起點經所有檢查點抵達終點。');
  } else {
    alert('❌ 路徑驗證失敗！請確認起點、終點、檢查點都已設定，且路線暢通無阻。');
  }
});

document.getElementById('btnEditorClear')!.addEventListener('click', () => {
  if (confirm('確定要清空目前的編輯內容嗎？')) {
    initEditor();
  }
});

document.getElementById('btnEditorSave')!.addEventListener('click', () => { editorSave(); });
document.getElementById('btnBackFromEditor')!.addEventListener('click', () => { playSFX('click'); switchScene('LEVEL_SELECT'); });
document.getElementById('btnCreateMap')!.addEventListener('click', () => { playSFX('click'); switchScene('MAP_EDITOR'); });

// ============================================================
// 2. 天賦頁面渲染
// ============================================================

function renderTalentScreen() {
  document.getElementById('talentPointsVal')!.textContent = getAvailablePoints(talentData).toString();

  const cards = document.querySelectorAll('.talent-card');
  cards.forEach(cardEl => {
    const tid = cardEl.getAttribute('data-id') as TalentId;
    const node = TALENT_TREE.find(t => t.id === tid);
    if (!node) return;

    const level = talentData.talentLevels[tid] || 0;
    const isMax = level >= node.maxLevel;
    const canUpgrade = canUnlockTalent(talentData, tid);

    // 更新樣式類別
    cardEl.className = 'talent-card';
    if (level === 0) {
      if (canUpgrade) cardEl.classList.add('available');
      else cardEl.classList.add('locked');
    } else {
      cardEl.classList.add('unlocked');
      if (canUpgrade && !isMax) cardEl.classList.add('available');
    }

    // 根據天賦 ID 取得大圖示 emoji
    const emojiMap: Record<TalentId, string> = {
      fortress_1: '🛡️', fortress_2: '🏰',
      gold_1: '💰', gold_2: '🪙',
      precise_1: '🎯', precise_2: '⚔️', rapid_fire: '⚡',
      wood_awakening: '🌿', water_awakening: '💧', fire_awakening: '🔥',
      earth_awakening: '⛰️', metal_awakening: '⚔️',
      yin_law: '🌑', yang_law: '☀️', taiji_dao: '☯️',
      wall_discount: '🧱'
    };
    const emoji = emojiMap[tid] || '✨';

    // 計算未滿足的前置條件文字
    let prereqHtml = '';
    if (node.prerequisites.length > 0) {
      const unmetPrereqs = node.prerequisites.filter(
        pid => (talentData.talentLevels[pid] || 0) < 1
      );
      if (unmetPrereqs.length > 0) {
        const prereqNames = unmetPrereqs.map(pid => {
          const prereqNode = TALENT_TREE.find(t => t.id === pid);
          return prereqNode ? prereqNode.name : pid;
        });
        prereqHtml = `<div class="talent-card-prereq">🔒 需解鎖：${prereqNames.join('、')}</div>`;
      }
    }

    cardEl.innerHTML = `
      <div class="talent-icon">${emoji}</div>
      <div class="talent-card-info">
        <div class="talent-card-title">
          <span>${node.name}</span>
          <span class="talent-card-level">Lv.${level}/${node.maxLevel}</span>
        </div>
        <div class="talent-card-desc">${node.description}</div>
        ${prereqHtml}
        <div class="talent-card-cost">${isMax ? '✨ 已滿級' : `升級花費: ${node.cost} 點`}</div>
      </div>
    `;


    // 重設並重新綁定點擊事件
    const htmlEl = cardEl as HTMLElement;
    htmlEl.onclick = null;
    if (canUpgrade && !isMax) {
      htmlEl.onclick = () => {
        playSFX('click');
        unlockTalent(talentData, tid);
        renderTalentScreen();
      };
    }
  });

  // 更新所有箭頭的 active 狀態
  const arrows = document.querySelectorAll('.talent-arrow');
  arrows.forEach(arrowEl => {
    const fromId = arrowEl.getAttribute('data-from') as TalentId;
    const fromLvl = talentData.talentLevels[fromId] || 0;
    if (fromLvl >= 1) {
      arrowEl.classList.add('active');
    } else {
      arrowEl.classList.remove('active');
    }
  });
}

function initBgStars() {
  bgStars = [];
  const starCount = 80;
  for (let i = 0; i < starCount; i++) {
    bgStars.push({
      x: Math.random() * (COLS * TILE_SIZE),
      y: Math.random() * (ROWS * TILE_SIZE),
      size: 0.5 + Math.random() * 1.5,
      alpha: Math.random(),
      alphaSpeed: 0.005 + Math.random() * 0.015
    });
  }
}

// ============================================================
// 3. 戰鬥初始化
// ============================================================

function startBattle() {
  // 根據地圖動態決定網格大小與 TILE_SIZE
  if (currentMap.id === 'test_level') {
    COLS = 20;
    ROWS = 10;
    TILE_SIZE = 64;
  } else {
    COLS = 80;
    ROWS = 40;
    TILE_SIZE = 16;
  }

  // 重新分配 grid 大小
  grid = Array.from({ length: COLS }, () => Array(ROWS).fill(0));

  // 讀取地圖配置
  SPAWN_POINT = currentMap.spawnPoint;
  BASE_POINT = currentMap.basePoint;
  WAYPOINTS = currentMap.waypoints;

  // 讀取天賦效果
  hp = getBaseHP(talentData);
  gold = currentMap.id === 'test_level' ? 999999 : getStartGold(talentData);
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

  // 清空網格並放置預設障礙物
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) grid[x][y] = 0;
  for (const obs of currentMap.obstacles) {
    if (obs.x >= 0 && obs.x < COLS && obs.y >= 0 && obs.y < ROWS) {
      grid[obs.x][obs.y] = 2; // 2 代表天然地形障礙物
    }
  }

  // 初始化星空背景與天氣粒子
  initBgStars();
  weatherParticles = [];
  lightningActive = 0;
  currentTheme = (selectTheme.value as ThemeId) || 'scifi';
  currentWeather = (selectWeather.value as WeatherId) || 'none';

  // 動態生成砲台按鈕
  buildTowerButtons();
  selectedTool = 'earth';
  refreshToolSelection();
  updateUI();

  // 啟動遊戲迴圈
  if (animFrameId) cancelAnimationFrame(animFrameId);
  recalculatePathTiles();
  gameLoop();
}

function buildTowerButtons() {
  towerButtonsContainer.innerHTML = '';
  const towerIds: TowerTypeId[] = ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'];

  for (const tid of towerIds) {
    const def = BASE_TOWERS[tid];
    if (!def) continue;
    const unlocked = currentMap.id === 'test_level' ? true : isTowerUnlocked(talentData, tid);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.setAttribute('data-tool', tid);
    btn.disabled = !unlocked;
    const cost = tid === 'earth' ? getWallCost(talentData) : def.cost;
    btn.textContent = `${def.emoji} ${def.name} (${cost}g)`;
    if (!unlocked && currentMap.id !== 'test_level') btn.title = '需先在天賦頁解鎖';
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
    if (currentMap && currentMap.id === 'tutorial') {
      instructionText.innerHTML = '🎓 <span style="color:#fbbf24; font-weight:bold;">教學引導：</span>因橫向長牆阻擋，怪物必須先向右繞過 3 號點入口才進入 1 號點。推薦在右側瓶頸 <span style="color:#38bdf8; font-weight:bold;">(58, 17)</span> 建造攻擊塔，讓怪物在三個尋路階段反覆受擊！';
    } else {
      instructionText.innerHTML = '選擇砲台後點擊地圖擺放。怪物依序碰觸 <span style="color:#f59e0b">❶❷❸❹❺</span> 檢查點再抵達基地。用砲台築迷宮！';
    }
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
      if (grid[nx][ny] !== 0 || (nx === blockedX && ny === blockedY)) continue;
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

let cachedPathTiles = new Set<string>();
let cachedFullPath: Point[] = [];

function recalculatePathTiles() {
  cachedPathTiles.clear();
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

  if (!blocked) {
    for (const pt of fullPath) {
      cachedPathTiles.add(`${pt.x},${pt.y}`);
    }
    cachedFullPath = fullPath;
  } else {
    cachedFullPath = [];
  }
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
  recalculatePathTiles();
}

// ============================================================
// 5. 砲台放置 / 拆除 / 合成
// ============================================================

canvas.addEventListener('click', (e) => {
  if (currentScene !== 'BATTLE') return;

  // 如果剛剛是拖曳地圖，則這次點擊不觸發放置或售塔
  if (isDraggingMap) {
    isDraggingMap = false;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

  // 反向換算地圖平移與縮放後的座標
  const worldX = (clickX - mapOffsetX) / mapScale;
  const worldY = (clickY - mapOffsetY) / mapScale;

  const gx = Math.max(0, Math.min(COLS - 1, Math.floor(worldX / TILE_SIZE)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor(worldY / TILE_SIZE)));

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
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

  const worldX = (clickX - mapOffsetX) / mapScale;
  const worldY = (clickY - mapOffsetY) / mapScale;

  const gx = Math.max(0, Math.min(COLS - 1, Math.floor(worldX / TILE_SIZE)));
  const gy = Math.max(0, Math.min(ROWS - 1, Math.floor(worldY / TILE_SIZE)));
  handleSell(gx, gy);
});

function handleBuild(x: number, y: number) {
  if (grid[x][y] !== 0) { showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '已有建物', '#ef4444', 15); return; }
  const def = BASE_TOWERS[selectedTool];
  if (!def) return;
  const cost = selectedTool === 'earth' ? getWallCost(talentData) : def.cost;
  if (gold < cost) { showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '金幣不足', '#ef4444', 15); return; }

  if (def.isWall && !validatePlacement(x, y)) {
    showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '不能堵死怪物！', '#ef4444', 15);
    return;
  }

  grid[x][y] = def.isWall ? 1 : 0;
  towers.push({ id: nextTowerId++, x, y, typeId: def.id, def: { ...def, cost }, cooldown: 0, recoilY: 0 });
  if (currentMap.id !== 'test_level') gold -= cost;
  updateUI();
  if (def.isWall) updateAllEnemyPaths();
}

function handleSell(x: number, y: number) {
  if (grid[x][y] === 2) {
    showFloat(x * TILE_SIZE + 8, y * TILE_SIZE, '天然障礙物無法拆除', '#ef4444', 15);
    return;
  }
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
    // 陰陽合成需天賦（測試關卡除外）
    if ((el1 === 'yin' || el1 === 'yang') && (el2 === 'yin' || el2 === 'yang')) {
      if (currentMap.id !== 'test_level' && (talentData.talentLevels['taiji_dao'] || 0) < 1) {
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
  createMergeParticles(tower1.x * TILE_SIZE + TILE_SIZE / 2, tower1.y * TILE_SIZE + TILE_SIZE / 2);
  playSFX('merge_success');
}

// ============================================================
// 6. 波次系統
// ============================================================

const MAX_WAVES = 20; // 通關波次

btnStartWave.addEventListener('click', () => {
  if (isWaveActive || currentScene !== 'BATTLE') return;
  playSFX('click');
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
          dotDamage: 0, dotDuration: 0,
          hitFlashFrame: 0,
          vx: 0,
          vy: 0,
          squashX: 1,
          squashY: 1
        });
      }
      spawned++;
      waveSpawned++;
    }, cfg.spawnIntervalMs);
    spawnTimers.push(timer);
  }
}

function spawnTestEnemy(enemyType: EnemyTypeId) {
  const def = ENEMY_DEFS[enemyType];
  if (!def) return;
  const startPos = { ...SPAWN_POINT };
  const path = astarFind(startPos, WAYPOINTS[0], def.isFlying);
  if (!path) {
    showFloat(startPos.x * TILE_SIZE + 8, startPos.y * TILE_SIZE, '起點路徑被堵死！', '#ef4444', 15);
    return;
  }

  // 強度計算：基於當前波次（如果波次為 0 則預設為 1）
  const curWave = wave || 1;
  const configs = getWaveConfig(curWave);
  const hpMult = configs[0] ? configs[0].hpMultiplier : 1.0;

  enemies.push({
    id: nextEnemyId++,
    type: enemyType,
    element: def.element,
    x: startPos.x * TILE_SIZE + TILE_SIZE / 2,
    y: startPos.y * TILE_SIZE + TILE_SIZE / 2,
    currentGridX: startPos.x, currentGridY: startPos.y,
    hp: Math.floor(def.baseHp * hpMult),
    maxHp: Math.floor(def.baseHp * hpMult),
    speed: def.speed,
    baseSpeed: def.speed,
    goldAward: def.goldAward,
    isFlying: def.isFlying,
    waypointIndex: 0,
    path, pathIndex: 0,
    slowDuration: 0,
    dotDamage: 0, dotDuration: 0,
    hitFlashFrame: 0,
    vx: 0,
    vy: 0,
    squashX: 1,
    squashY: 1
  });

  updateUI();
  showFloat(startPos.x * TILE_SIZE + 8, startPos.y * TILE_SIZE, `Spawned ${def.name}!`, '#8b5cf6', 14);
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

    // 遞減受擊高亮與形變恢復
    if (e.hitFlashFrame > 0) {
      e.hitFlashFrame--;
    }
    if (e.squashX === undefined) { e.squashX = 1; e.squashY = 1; }
    e.squashX += (1 - e.squashX) * 0.15;
    e.squashY += (1 - e.squashY) * 0.15;

    // 減速
    if (e.slowDuration > 0) { e.slowDuration--; e.speed = e.baseSpeed * 0.4; }
    else { e.speed = e.baseSpeed; }

    const prevX = e.x;
    const prevY = e.y;
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
            if (currentMap.id !== 'test_level') {
              hp -= 1;
            }
            enemies.splice(i, 1);
            updateUI();
            if (currentMap.id !== 'test_level' && hp <= 0) { endBattle(false); return; }
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
    e.vx = e.x - prevX;
    e.vy = e.y - prevY;
  }

  // 2. 砲台射擊
  for (const tower of towers) {
    if (tower.recoilY === undefined) tower.recoilY = 0;
    tower.recoilY *= 0.82;
    if (tower.recoilY < 0.05) tower.recoilY = 0;

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

      playSFX('shoot');

      tower.cooldown = Math.floor(tower.def.fireRate * frMult);
      tower.recoilY = 4.0;
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
      
      b.targetEnemy.hitFlashFrame = 6;
      b.targetEnemy.squashX = 1.35;
      b.targetEnemy.squashY = 0.65;

      // 產生屬性對應的擊中粒子
      const bulletColors: Record<string, string> = {
        fire: '#f97316', water: '#38bdf8', wood: '#4ade80',
        earth: '#d97706', metal: '#e5e7eb', yin: '#a855f7', yang: '#fde047'
      };
      const hitColor = bulletColors[b.element] ?? '#facc15';
      createHitParticles(b.targetEnemy.x, b.targetEnemy.y, hitColor);
      createSplatterParticles(b.targetEnemy.x, b.targetEnemy.y, hitColor, 4);

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
            
            e.hitFlashFrame = 6;
            e.squashX = 1.35;
            e.squashY = 0.65;
            createSplatterParticles(e.x, e.y, hitColor, 3);
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
          
          createDeathParticles(b.targetEnemy.x, b.targetEnemy.y, hitColor);
          createSplatterParticles(b.targetEnemy.x, b.targetEnemy.y, hitColor, 8);

          enemies.splice(eidx, 1);
          playSFX('enemy_death');
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
          const pColor = ENEMY_DEFS[enemies[j].type]?.colorPrimary ?? '#facc15';
          createDeathParticles(enemies[j].x, enemies[j].y, pColor);
          createSplatterParticles(enemies[j].x, enemies[j].y, pColor, 8);
          enemies.splice(j, 1);
          playSFX('enemy_death');
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

  // 6. 更新粒子特效 (Phase 4)
  updateParticles();

  // 7. 更新背景星星與天氣 (Phase 4)
  updateBgStars();
  updateWeather();
}

function updateBgStars() {
  for (const star of bgStars) {
    star.alpha += star.alphaSpeed;
    if (star.alpha > 1.0 || star.alpha < 0.2) {
      star.alphaSpeed = -star.alphaSpeed;
    }
  }
}

function updateWeather() {
  // 更新閃電計時
  if (currentWeather === 'thunder') {
    if (lightningActive > 0) {
      lightningActive--;
    } else {
      if (lightningTimer > 0) {
        lightningTimer--;
      } else {
        // 觸發閃電機率
        if (Math.random() < 0.005) {
          lightningActive = 10 + Math.floor(Math.random() * 15); // 閃電持續 10-25 幀
          lightningTimer = 180 + Math.floor(Math.random() * 240); // 隨機 3~7 秒冷卻
          generateLightningPaths();
        }
      }
    }
  } else {
    lightningActive = 0;
  }

  // 更新天氣粒子
  if (currentWeather === 'none') {
    weatherParticles = [];
    return;
  }

  // 1. 產生新粒子
  if (currentWeather === 'rain' || currentWeather === 'thunder') {
    // 雨/雷雨：每幀產生雨粒子
    const spawnCount = currentWeather === 'thunder' ? 4 : 2;
    for (let i = 0; i < spawnCount; i++) {
      weatherParticles.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: -1.5 - Math.random() * 1.5,
        vy: 8 + Math.random() * 4,
        size: 1 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.4,
        length: 12 + Math.random() * 15
      });
    }
  } else if (currentWeather === 'fog') {
    // 霧氣粒子初始化與定時補充
    if (weatherParticles.length < 25) {
      const isInit = weatherParticles.length === 0;
      const spawnCount = isInit ? 25 : 1;
      for (let i = 0; i < spawnCount; i++) {
        weatherParticles.push({
          x: isInit ? Math.random() * canvas.width : -120,
          y: Math.random() * canvas.height,
          vx: 0.2 + Math.random() * 0.4,
          vy: (Math.random() - 0.5) * 0.1,
          size: 80 + Math.random() * 80,
          alpha: 0.02 + Math.random() * 0.05
        });
      }
    }
  }

  // 2. 移動並過濾粒子
  for (let i = weatherParticles.length - 1; i >= 0; i--) {
    const p = weatherParticles[i];
    p.x += p.vx;
    p.y += p.vy;

    // 邊界檢查
    if (currentWeather === 'rain' || currentWeather === 'thunder') {
      if (p.y > canvas.height + 20 || p.x < -20) {
        weatherParticles.splice(i, 1);
      }
    } else if (currentWeather === 'fog') {
      if (p.x > canvas.width + 150) {
        weatherParticles.splice(i, 1);
      }
    }
  }
}

function generateLightningPaths() {
  lightningPaths = [];
  const pathCount = 1 + Math.floor(Math.random() * 2);
  for (let p = 0; p < pathCount; p++) {
    const path: Point[] = [];
    let curX = 100 + Math.random() * (canvas.width - 200);
    let curY = 0;
    path.push({ x: curX, y: curY });
    
    const segmentCount = 6 + Math.floor(Math.random() * 6);
    const targetY = canvas.height * 0.6 + Math.random() * (canvas.height * 0.4);
    const dy = targetY / segmentCount;
    
    for (let i = 0; i < segmentCount; i++) {
      curY += dy;
      curX += (Math.random() - 0.5) * 60;
      path.push({ x: curX, y: curY });
    }
    lightningPaths.push(path);
  }
}

// ============================================================
// 8. 結算
// ============================================================

function endBattle(isVictory: boolean) {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  spawnTimers.forEach(t => clearInterval(t));
  spawnTimers = [];

  const earned = currentMap.id === 'test_level' ? 0 : calcTalentPointsEarned(wave);
  if (currentMap.id !== 'test_level') {
    addTalentPoints(talentData, earned);
  }

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
    // 達到最大波次則勝利 (測試關卡除外)
    if (currentMap.id !== 'test_level' && wave >= MAX_WAVES) {
      setTimeout(() => endBattle(true), 1500);
    } else {
      // 禁止超過最大波次 (測試關卡除外，可以無限挑戰)
      btnStartWave.disabled = currentMap.id !== 'test_level' && wave >= MAX_WAVES;
    }
  }
}

// ============================================================
// 9. 渲染
// ============================================================

function renderGame() {
  const renderStart = performance.now();
  drawCallCount = 0;
  let bgFillStyle = '#020617';
  let gridStrokeStyle = '#1e293b';
  
  if (currentTheme === 'chinese') {
    bgFillStyle = '#2b0909';
    gridStrokeStyle = '#6b1d1d';
  } else if (currentTheme === 'ink') {
    bgFillStyle = '#f8fafc';
    gridStrokeStyle = '#e2e8f0';
  } else if (currentTheme === 'starry') {
    bgFillStyle = '#060a16';
    gridStrokeStyle = '#131e3a';
  }
  
  ctx.fillStyle = bgFillStyle;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(mapOffsetX, mapOffsetY);
  ctx.scale(mapScale, mapScale);

  // 1. 繪製平鋪地板與路徑 Tile (極致原生像素風方案 D)
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      const isPath = cachedPathTiles.has(`${x},${y}`);
      drawTile(ctx, currentTheme, isPath, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE / 16, x, y);
      drawCallCount++;
    }
  }

  // 2. 繪製璀璨星空的背景星星 (疊加在星空地板上，微微閃爍)
  if (currentTheme === 'starry') {
    for (const star of bgStars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. 網格線
  ctx.strokeStyle = gridStrokeStyle; ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * TILE_SIZE, 0); ctx.lineTo(x * TILE_SIZE, ROWS * TILE_SIZE); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE_SIZE); ctx.lineTo(COLS * TILE_SIZE, y * TILE_SIZE); ctx.stroke(); }

  // 4. 繪製常駐的半透明怪物行進路線與方向辨識 (非 MAP_EDITOR 狀態下)
  if (currentScene === 'BATTLE' && cachedFullPath.length > 0) {
    const routeScale = TILE_SIZE / 16;
    ctx.save();
    ctx.lineWidth = 1.5 * routeScale;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)'; // 非常低調的 25% 透明金黃色
    ctx.shadowBlur = 3 * routeScale;
    ctx.shadowColor = '#f59e0b';

    ctx.beginPath();
    const startX = cachedFullPath[0].x * TILE_SIZE + TILE_SIZE / 2;
    const startY = cachedFullPath[0].y * TILE_SIZE + TILE_SIZE / 2;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < cachedFullPath.length; i++) {
      const tx = cachedFullPath[i].x * TILE_SIZE + TILE_SIZE / 2;
      const ty = cachedFullPath[i].y * TILE_SIZE + TILE_SIZE / 2;
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // 繪製微型流動虛線
    ctx.lineWidth = 1.0 * routeScale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; // 半透明白色
    ctx.setLineDash([4 * routeScale, 10 * routeScale]);
    ctx.lineDashOffset = -(Date.now() / 25) * routeScale; // 移動速度慢一點，比較低調
    ctx.stroke();

    // 繪製常駐的方向箭頭
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 2 * routeScale;
    ctx.shadowColor = '#fbbf24';

    const arrowSpacing = 64 * routeScale; // 間距大一點，更加清爽
    const arrowSize = 2.5 * routeScale; // 箭頭小一點，不遮擋防禦塔
    const animOffset = (Date.now() / 25) % arrowSpacing;

    for (let i = 0; i < cachedFullPath.length - 1; i++) {
      const x1 = cachedFullPath[i].x * TILE_SIZE + TILE_SIZE / 2;
      const y1 = cachedFullPath[i].y * TILE_SIZE + TILE_SIZE / 2;
      const x2 = cachedFullPath[i+1].x * TILE_SIZE + TILE_SIZE / 2;
      const y2 = cachedFullPath[i+1].y * TILE_SIZE + TILE_SIZE / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const ux = dx / len;
      const uy = dy / len;

      let dist = animOffset;
      while (dist < len) {
        const ax = x1 + ux * dist;
        const ay = y1 + uy * dist;

        ctx.beginPath();
        ctx.moveTo(ax + ux * arrowSize * 1.5, ay + uy * arrowSize * 1.5);
        ctx.lineTo(ax - ux * arrowSize + uy * arrowSize * 0.8, ay - uy * arrowSize - ux * arrowSize * 0.8);
        ctx.lineTo(ax - ux * arrowSize - uy * arrowSize * 0.8, ay - uy * arrowSize + ux * arrowSize * 0.8);
        ctx.closePath();
        ctx.fill();

        dist += arrowSpacing;
      }
    }
    ctx.restore();
  }

  // 繪製地圖預設地形障礙物
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (grid[x][y] === 2) {
        drawObstacle(ctx, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
  }

  // 在教學關卡繪製推薦建造位置的高亮提示
  if (currentMap && currentMap.id === 'tutorial') {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    const rx = 58 * TILE_SIZE;
    const ry = 17 * TILE_SIZE;
    ctx.strokeRect(rx, ry, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💡 推薦建造點', rx - 18, ry - 4);
    ctx.restore();
  }

  // 起點 / 終點
  let spawnColor = '#22c55e';
  let baseColor = '#ef4444';
  if (currentTheme === 'chinese') {
    spawnColor = '#fbbf24'; // 帝王金起點
    baseColor = '#dc2626'; // 宮殿紅終點
  } else if (currentTheme === 'ink') {
    spawnColor = '#475569'; // 墨灰起點
    baseColor = '#0f172a'; // 濃墨終點
  } else if (currentTheme === 'starry') {
    spawnColor = '#06b6d4'; // 青色星雲
    baseColor = '#ec4899'; // 粉色超新星
  }

  ctx.fillStyle = spawnColor;
  ctx.fillRect(SPAWN_POINT.x * TILE_SIZE, SPAWN_POINT.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = baseColor;
  ctx.fillRect(BASE_POINT.x * TILE_SIZE, BASE_POINT.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

  // 檢查點
  WAYPOINTS.forEach((wp, idx) => {
    ctx.beginPath();
    const wpScale = TILE_SIZE / 16;
    ctx.arc(wp.x * TILE_SIZE + TILE_SIZE / 2, wp.y * TILE_SIZE + TILE_SIZE / 2, 10 * wpScale, 0, Math.PI * 2);
    
    let wpBg = '#f59e0b';
    let wpFg = '#fff';
    
    if (currentTheme === 'chinese') {
      wpBg = '#ea580c';
    } else if (currentTheme === 'ink') {
      wpBg = '#334155';
    } else if (currentTheme === 'starry') {
      wpBg = '#8b5cf6';
    }
    
    ctx.fillStyle = wpBg; ctx.fill();
    
    if (currentTheme === 'ink') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1 * wpScale;
      ctx.stroke();
    }
    
    ctx.fillStyle = wpFg; ctx.font = `bold ${Math.round(11 * wpScale)}px Outfit, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((idx + 1).toString(), wp.x * TILE_SIZE + TILE_SIZE / 2, wp.y * TILE_SIZE + TILE_SIZE / 2);
  });

  // 砲台（使用像素精靈）
  for (const t of towers) {
    drawTowerSprite(ctx, t.typeId, t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE / 16, currentStyle, t.cooldown, t.def.fireRate, t.recoilY);
    drawCallCount++;

    // 合成模式高亮選中的第一座塔
    if (mergeMode && mergeFirstTower && mergeFirstTower.id === t.id) {
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2 * (TILE_SIZE / 16);
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
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1 * (TILE_SIZE / 16);
    ctx.strokeRect(tw.x * TILE_SIZE, tw.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    drawCallCount++;
    ctx.restore();
  }

  // 怪物（使用像素精靈）
  for (const e of enemies) {
    drawEnemySprite(ctx, e.type, e.x, e.y, e.hitFlashFrame, TILE_SIZE / 16, currentStyle, e.vx, e.vy, e.squashX, e.squashY);
    drawCallCount++;

    // 血條 (依地圖比例縮放)
    const hpPct = e.hp / e.maxHp;
    const hpScale = TILE_SIZE / 16;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(e.x - 8 * hpScale, e.y - 12 * hpScale, 16 * hpScale, 3 * hpScale);
    ctx.fillStyle = e.slowDuration > 0 ? '#06b6d4' : '#10b981';
    ctx.fillRect(e.x - 8 * hpScale, e.y - 12 * hpScale, 16 * hpScale * hpPct, 3 * hpScale);

    // DOT 指示
    if (e.dotDuration > 0) {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(e.x - 8 * hpScale, e.y - 9 * hpScale, 16 * hpScale * (e.dotDuration / 60), 1 * hpScale);
    }
  }

  // 子彈
  for (const b of bullets) {
    const bScale = TILE_SIZE / 16;
    const bulletThemes: Record<string, { core: string; mid: string; glow: string; trail: string; r: number }> = {
      fire: { core: '#fef08a', mid: '#f97316', glow: '#ef4444', trail: '#7f1c1d', r: 5 },
      water: { core: '#ffffff', mid: '#60a5fa', glow: '#2563eb', trail: '#1e3a8a', r: 4 },
      wood: { core: '#a7f3d0', mid: '#22c55e', glow: '#166534', trail: '#052e16', r: 4 },
      metal: { core: '#ffffff', mid: '#cbd5e1', glow: '#94a3b8', trail: '#475569', r: 5 },
      yin: { core: '#ffffff', mid: '#d8b4fe', glow: '#a855f7', trail: '#3b0764', r: 4 },
      yang: { core: '#ffffff', mid: '#fef08a', glow: '#fbbf24', trail: '#854d0e', r: 5 },
      earth: { core: '#fef08a', mid: '#f59e0b', glow: '#d97706', trail: '#78350f', r: 5 }
    };
    const theme = bulletThemes[b.element] || bulletThemes.fire;
    
    // 計算面向目標的追蹤方向以生成拖影
    let ux = 1;
    let uy = 0;
    if (b.targetEnemy) {
      const dx = b.targetEnemy.x - b.x;
      const dy = b.targetEnemy.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        ux = dx / dist;
        uy = dy / dist;
      }
    }
    
    // 1. 繪製多段追蹤拖影
    for (let i = 1; i < 5; i++) {
      const tx = b.x - i * 5 * bScale * ux;
      const ty = b.y - i * 5 * bScale * uy;
      const alpha = (1.0 - i / 5) * 0.65;
      const radius = (theme.r * (1.0 - i / 5) + 1.0) * bScale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 6 * bScale;
      ctx.shadowColor = theme.glow;
      ctx.fillStyle = theme.trail;
      ctx.beginPath();
      ctx.arc(tx, ty, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // 2. 繪製發光核心
    ctx.save();
    ctx.shadowBlur = 15 * bScale;
    ctx.shadowColor = theme.glow;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, theme.r * bScale);
    g.addColorStop(0, theme.core);
    g.addColorStop(0.5, theme.mid);
    g.addColorStop(1, theme.glow);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, theme.r * bScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    drawCallCount++;
  }

  // 飄字
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    const fSize = (ft.fontSize || 11) * (TILE_SIZE / 16);
    ctx.font = `bold ${fSize}px Outfit, sans-serif`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    drawCallCount++;
    ctx.restore();
  }

  // 粒子特效 (Phase 4)
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    if (p.isRing) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * (TILE_SIZE / 16);
      ctx.shadowBlur = 12 * (TILE_SIZE / 16);
      ctx.shadowColor = p.color;
      ctx.stroke();
      drawCallCount++;
    } else if (p.isPixel) {
      // 懷舊硬派像素粒子：繪製正方形，不加發光陰影
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      drawCallCount++;
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4 * (TILE_SIZE / 16);
      ctx.shadowColor = p.color;
      ctx.fill();
      drawCallCount++;
    }
    ctx.restore();
  }

  if (routePreviewTimer > 0) {
    drawRoutePreview();
  }

  ctx.restore(); // 結束地圖相關縮放與平移 (Phase 4)

  // === 繪製天氣特效 Overlay ===
  if (currentWeather === 'rain' || currentWeather === 'thunder') {
    ctx.save();
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
    for (const p of weatherParticles) {
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 1.5, p.y + p.vy * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  } else if (currentWeather === 'fog') {
    ctx.save();
    for (const p of weatherParticles) {
      const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      radGrad.addColorStop(0, `rgba(226, 232, 240, ${p.alpha})`);
      radGrad.addColorStop(0.5, `rgba(226, 232, 240, ${p.alpha * 0.5})`);
      radGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 繪製雷電效果
  if (currentWeather === 'thunder' && lightningActive > 0) {
    ctx.save();
    if (Math.random() < 0.7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.random() * 0.25})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#e0f2fe';
    ctx.lineWidth = 2.5 + Math.random() * 2;
    
    for (const path of lightningPaths) {
      if (path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 繪製阻塞警告文字（固定在畫布中心，不受平移和縮放影響）
  if (routePreviewTimer > 0 && cachedPreviewRoute.length === 0) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 路線被完全阻塞！無法通往基地', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  // 性能監控指標更新
  const latency = performance.now() - renderStart;
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdateTime > 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
    frameCount = 0;
    lastFpsUpdateTime = now;
  }

  if (isDiagnosticOpen) {
    diagFps.textContent = currentFps.toString();
    diagLatency.textContent = latency.toFixed(1) + ' ms';
    diagDrawCalls.textContent = drawCallCount.toString();
    diagCacheSize.textContent = spriteCache.size.toString();
    diagMonsters.textContent = enemies.length.toString();
    diagTowers.textContent = towers.length.toString();
    diagFilterWarning.textContent = '0'; // 所有主渲染濾鏡已完全移除快取化，調用次數為 0
  }
}

// ============================================================
// 粒子特效輔助函數 (Phase 4)
// ============================================================

function createSplatterParticles(x: number, y: number, color: string, count: number = 4) {
  const pScale = TILE_SIZE / 16;
  for (let i = 0; i < count; i++) {
    const vx = (Math.random() - 0.5) * 3 * pScale;
    const vy = (-1.5 - Math.random() * 2.5) * pScale;
    particles.push({
      x, y,
      vx, vy,
      color,
      alpha: 1.0,
      size: (1.5 + Math.random() * 2) * pScale,
      life: 0,
      maxLife: 20 + Math.floor(Math.random() * 15),
      gravity: 0.18 * pScale,
      isPixel: true,
      dragMultiplier: 0.98
    });
  }
}

function createHitParticles(x: number, y: number, color: string) {
  const pScale = TILE_SIZE / 16;
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 3) * pScale;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: (2 + Math.random() * 3) * pScale,
      life: 0,
      maxLife: 20 + Math.floor(Math.random() * 15)
    });
  }
}

function createDeathParticles(x: number, y: number, color: string) {
  const pScale = TILE_SIZE / 16;
  const count = 15 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1.5 + Math.random() * 4) * pScale;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: (3 + Math.random() * 4) * pScale,
      life: 0,
      maxLife: 30 + Math.floor(Math.random() * 20)
    });
  }
  // 額外生成一圈元素色環狀死亡衝擊波
  particles.push({
    x, y,
    vx: 0, vy: 0,
    color,
    alpha: 1.0,
    size: 4 * pScale,
    life: 0,
    maxLife: 35,
    isRing: true,
    maxRadius: 60 * pScale
  });
}

function createMergeParticles(x: number, y: number) {
  const pScale = TILE_SIZE / 16;
  const count = 36;
  const radius = 8 * pScale;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.8 * pScale;
    particles.push({
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#c084fc',
      alpha: 1.0,
      size: 3 * pScale,
      life: 0,
      maxLife: 40
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life++;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    
    if (p.isRing) {
      p.size += (p.maxRadius! - p.size) * 0.15;
    } else {
      if (p.gravity !== undefined) {
        p.vy += p.gravity;
      }
      p.x += p.vx;
      p.y += p.vy;
      const drag = p.dragMultiplier !== undefined ? p.dragMultiplier : 0.95;
      p.vx *= drag;
      p.vy *= drag;
    }
    
    p.alpha = 1.0 - p.life / p.maxLife;
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  if (currentTheme === 'scifi') {
    // 藍色高科技合金柱
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
  } else if (currentTheme === 'chinese') {
    // 古風暗紅色石墩
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE / 2, y + 2);
    ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE - 2);
    ctx.moveTo(x + 2, y + TILE_SIZE / 2);
    ctx.lineTo(x + TILE_SIZE - 2, y + TILE_SIZE / 2);
    ctx.stroke();
  } else if (currentTheme === 'ink') {
    // 濃墨山石
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (currentTheme === 'starry') {
    // 紫色晶體隕石
    ctx.fillStyle = '#4c1d95';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 1);
    ctx.lineTo(x + 15, y + 6);
    ctx.lineTo(x + 13, y + 14);
    ctx.lineTo(x + 3, y + 14);
    ctx.lineTo(x + 1, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoutePreview() {
  if (cachedPreviewRoute.length === 0) {
    return;
  }

  const routeScale = TILE_SIZE / 16;
  ctx.save();
  
  // 設定高對比度、與 Sci-Fi 藍色障礙物對比強烈的霓虹金黃/橘黃色路線
  ctx.lineWidth = 4 * routeScale;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)'; // 橘黃色半透明
  ctx.shadowBlur = 8 * routeScale;
  ctx.shadowColor = '#f59e0b'; // 黃金霓虹光

  if (routePreviewTimer < 60) {
    ctx.globalAlpha = routePreviewTimer / 60;
  } else {
    ctx.globalAlpha = 1.0;
  }

  // 1. 繪製路徑底線
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

  // 2. 繪製黃金流動虛線 (流動方向與怪物前進方向一致)
  ctx.lineWidth = 2 * routeScale;
  ctx.strokeStyle = '#ffffff';
  ctx.setLineDash([6 * routeScale, 12 * routeScale]);
  ctx.lineDashOffset = -(Date.now() / 15) * routeScale;
  ctx.stroke();

  // 3. 繪製沿著路徑前進的方向箭頭 (Direction Indicators)
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 4 * routeScale;
  ctx.shadowColor = '#fbbf24'; // 亮金色 shadow

  const arrowSpacing = 48 * routeScale; // 箭頭間距
  const arrowSize = 4 * routeScale; // 箭頭大小
  const animOffset = (Date.now() / 15) % arrowSpacing; // 箭頭隨時間向前移動

  for (let i = 0; i < cachedPreviewRoute.length - 1; i++) {
    const x1 = cachedPreviewRoute[i].x * TILE_SIZE + TILE_SIZE / 2;
    const y1 = cachedPreviewRoute[i].y * TILE_SIZE + TILE_SIZE / 2;
    const x2 = cachedPreviewRoute[i+1].x * TILE_SIZE + TILE_SIZE / 2;
    const y2 = cachedPreviewRoute[i+1].y * TILE_SIZE + TILE_SIZE / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    const ux = dx / len;
    const uy = dy / len;

    // 在當前路徑段上繪製多個方向箭頭
    let dist = animOffset;
    while (dist < len) {
      const ax = x1 + ux * dist;
      const ay = y1 + uy * dist;

      // 繪製指向 (ux, uy) 方向的箭頭三角形
      ctx.beginPath();
      // 前端點 (指向方向)
      ctx.moveTo(ax + ux * arrowSize * 1.5, ay + uy * arrowSize * 1.5);
      // 後左端點
      ctx.lineTo(ax - ux * arrowSize + uy * arrowSize * 0.8, ay - uy * arrowSize - ux * arrowSize * 0.8);
      // 後右端點
      ctx.lineTo(ax - ux * arrowSize - uy * arrowSize * 0.8, ay - uy * arrowSize + ux * arrowSize * 0.8);
      ctx.closePath();
      ctx.fill();

      dist += arrowSpacing;
    }
  }

  ctx.restore();
}

function showFloat(x: number, y: number, text: string, color: string, fontSize?: number) {
  floatingTexts.push({ x, y, text, color, alpha: 1.0, life: 45, fontSize });
}

function updateUI() {
  hpVal.textContent = currentMap.id === 'test_level' ? '∞' : Math.floor(hp).toString();
  goldVal.textContent = currentMap.id === 'test_level' ? '∞' : gold.toString();
  waveVal.textContent = wave.toString();
  killVal.textContent = killCount.toString();
  btnStartWave.disabled = isWaveActive || (currentMap.id !== 'test_level' && wave >= MAX_WAVES);
  updateWaveProgress();

  const testControls = document.getElementById('testControls');
  if (testControls) {
    testControls.style.display = currentMap.id === 'test_level' ? 'flex' : 'none';
  }
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
document.getElementById('btnStartGame')!.addEventListener('click', () => { playSFX('click'); switchScene('LEVEL_SELECT'); });
document.getElementById('btnBackFromLevel')!.addEventListener('click', () => { playSFX('click'); switchScene('MAIN_MENU'); });
document.getElementById('btnTalent')!.addEventListener('click', () => { playSFX('click'); switchScene('TALENT_SCREEN'); });
document.getElementById('btnBackFromTalent')!.addEventListener('click', () => { playSFX('click'); switchScene('MAIN_MENU'); });
document.getElementById('btnBackToMenu')!.addEventListener('click', () => { playSFX('click'); switchScene('MAIN_MENU'); });
document.getElementById('btnResetTalents')!.addEventListener('click', () => {
  if (confirm('確定要重置所有天賦嗎？已花費的天賦點將全部退回。')) {
    resetTalents(talentData);
    renderTalentScreen();
  }
});

// 戰鬥場景按鈕
btnMerge.addEventListener('click', () => {
  playSFX('click');
  mergeMode = !mergeMode;
  mergeFirstTower = null;
  if (mergeMode) selectedTool = '';
  refreshToolSelection();
});
btnSell.addEventListener('click', () => {
  playSFX('click');
  mergeMode = false; mergeFirstTower = null;
  selectedTool = 'sell';
  refreshToolSelection();
});
btnQuitBattle.addEventListener('click', () => {
  playSFX('click');
  if (confirm('確定放棄本局嗎？將進行天賦結算。')) {
    endBattle(false);
  }
});

btnDiagnostics.addEventListener('click', () => {
  playSFX('click');
  isDiagnosticOpen = !isDiagnosticOpen;
  (diagnosticPanel as HTMLElement).style.display = isDiagnosticOpen ? 'block' : 'none';
  btnDiagnostics.classList.toggle('active', isDiagnosticOpen);
});

btnDiagExport.addEventListener('click', () => {
  playSFX('click');
  const cacheKeys = Array.from(spriteCache.keys());
  const report = {
    timestamp: new Date().toISOString(),
    fps: currentFps,
    monstersCount: enemies.length,
    towersCount: towers.length,
    bulletsCount: bullets.length,
    particlesCount: particles.length,
    drawCalls: drawCallCount,
    spriteCacheSize: spriteCache.size,
    spriteCacheKeys: cacheKeys,
    userGold: gold,
    userHP: hp,
    currentWave: wave,
    talentSaveData: loadTalentData(),
    devicePixelRatio: window.devicePixelRatio,
    browserAgent: navigator.userAgent
  };
  
  console.group('%c⚙️ Wuxing Maze TD — Performance Diagnostic Profile', 'color: #8b5cf6; font-weight: bold; font-size: 1.15rem;');
  console.log('%cGeneral Game Stats:', 'color: #38bdf8; font-weight: bold;');
  console.table({
    'FPS': report.fps,
    'Monsters': report.monstersCount,
    'Towers': report.towersCount,
    'Bullets': report.bulletsCount,
    'Particles': report.particlesCount,
    'Draw Calls (Last Frame)': report.drawCalls,
    'Cache Canvas Size': report.spriteCacheSize,
    'HP': report.userHP,
    'Gold': report.userGold,
    'Current Wave': report.currentWave
  });
  console.log('%cSprite Cache Inventory:', 'color: #fbbf24; font-weight: bold;', report.spriteCacheKeys);
  console.log('%cComplete Raw Profile Data:', 'color: #10b981; font-weight: bold;', report);
  console.groupEnd();

  floatingTexts.push({
    x: canvas.width / 2,
    y: canvas.height / 2 - 40,
    text: '📋 性能診斷報告已導出至 Console (F12)！',
    color: '#fbbf24',
    alpha: 1.0,
    life: 120,
    fontSize: 18
  });
});

btnShowRoute.addEventListener('click', () => {
  playSFX('click');
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

selectTheme.addEventListener('change', () => {
  currentTheme = selectTheme.value as ThemeId;
  playSFX('click');
});

selectWeather.addEventListener('change', () => {
  currentWeather = selectWeather.value as WeatherId;
  playSFX('click');
  if (currentWeather === 'thunder') {
    lightningTimer = 60 + Math.random() * 120;
  }
});

selectStyle.addEventListener('change', () => {
  currentStyle = selectStyle.value as 'pixel' | 'highres';
  playSFX('click');
});

// 初始化
talentData = loadTalentData();
initSprites();
loadAllHighResSprites();
refreshMenuTalentInfo();

/** 批量載入所有防禦塔與怪物的高品質 SD 精靈圖 */
function loadAllHighResSprites(): void {
  const SPRITE_BASE = 'assets/sprites';
  const imagePreloads: Array<[string, string]> = [
    // --- 怪物 ---
    ['enemy_snake',        `${SPRITE_BASE}/enemies/snake.png`],
    ['enemy_fly',          `${SPRITE_BASE}/enemies/fly.png`],
    ['enemy_salamander',   `${SPRITE_BASE}/enemies/salamander.png`],
    ['enemy_water_spirit', `${SPRITE_BASE}/enemies/water_spirit.png`],
    ['enemy_golem',        `${SPRITE_BASE}/enemies/golem.png`],
    ['enemy_beetle',       `${SPRITE_BASE}/enemies/beetle.png`],
    ['enemy_boss_dragon',  `${SPRITE_BASE}/enemies/boss_dragon.png`],
    // --- 基礎塔 ---
    ['tower_fire',         `${SPRITE_BASE}/towers/fire.png`],
    ['tower_water',        `${SPRITE_BASE}/towers/water.png`],
    ['tower_wood',         `${SPRITE_BASE}/towers/wood.png`],
    ['tower_earth',        `${SPRITE_BASE}/towers/earth.png`],
    ['tower_metal',        `${SPRITE_BASE}/towers/metal.png`],
    ['tower_yin',          `${SPRITE_BASE}/towers/yin.png`],
    ['tower_yang',         `${SPRITE_BASE}/towers/yang.png`],
    // --- Lv2 塔 ---
    ['tower_fire_2',       `${SPRITE_BASE}/towers_lv2/fire_2.png`],
    ['tower_water_2',      `${SPRITE_BASE}/towers_lv2/water_2.png`],
    ['tower_wood_2',       `${SPRITE_BASE}/towers_lv2/wood_2.png`],
    ['tower_earth_2',      `${SPRITE_BASE}/towers_lv2/earth_2.png`],
    ['tower_metal_2',      `${SPRITE_BASE}/towers_lv2/metal_2.png`],
    ['tower_yin_2',        `${SPRITE_BASE}/towers_lv2/yin_2.png`],
    ['tower_yang_2',       `${SPRITE_BASE}/towers_lv2/yang_2.png`],
    // --- 配方塔 ---
    ['tower_wood_fire',    `${SPRITE_BASE}/towers_recipe/wood_fire.png`],
    ['tower_fire_earth',   `${SPRITE_BASE}/towers_recipe/fire_earth.png`],
    ['tower_earth_metal',  `${SPRITE_BASE}/towers_recipe/earth_metal.png`],
    ['tower_metal_water',  `${SPRITE_BASE}/towers_recipe/metal_water.png`],
    ['tower_water_wood',   `${SPRITE_BASE}/towers_recipe/water_wood.png`],
    ['tower_yin_yang',     `${SPRITE_BASE}/towers_recipe/yin_yang.png`],
  ];
  imagePreloads.forEach(([key, src]) => {
    preloadImage(key, src);
  });
}

// ============================================================
// 天賦分支快速導覽列事件綁定
// ============================================================
(function initTalentNav() {
  const navBtns = document.querySelectorAll<HTMLButtonElement>('#talentNav .talent-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const trackId = btn.getAttribute('data-track');
      if (!trackId) return;

      // 高亮點擊的按鈕
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 平滑捲動至對應分支
      const trackEl = document.getElementById(trackId);
      if (trackEl) {
        trackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 使用 IntersectionObserver 自動更新高亮：當 track 進入視野時同步按鈕狀態
  const trackIds = ['track-base', 'track-attack', 'track-element', 'track-yinyang'];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navBtns.forEach(b => {
          if (b.getAttribute('data-track') === id) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.4 });

  trackIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();

// ============================================================
// 11. 行動裝置與手勢拖曳平移、雙指縮放處理 (Phase 4)
// ============================================================

// Auto-fit 縮放整個 game-container
function resizeGameContainer() {
  const container = document.querySelector('.game-container') as HTMLElement;
  if (!container) return;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const baseWidth = 1304; // 1280px + padding + border
  // 測試關卡因為有額外的測試工具面板，高度會比較高，給予較大的 baseHeight
  const isTest = typeof currentMap !== 'undefined' && currentMap && currentMap.id === 'test_level';
  const baseHeight = isTest ? 830 : 780; 

  const padding = 12; // 留點邊距緩衝
  const targetWidth = windowWidth - padding * 2;
  const targetHeight = windowHeight - padding * 2;

  const scaleX = targetWidth / baseWidth;
  const scaleY = targetHeight / baseHeight;

  // 取較小值，且最大縮放值為 1 (只縮小，不放大)
  let scale = Math.min(scaleX, scaleY);
  if (scale > 1) scale = 1;

  if (scale < 1) {
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'top center';
    if (container.parentElement) {
      container.parentElement.style.height = `${baseHeight * scale}px`;
    }
  } else {
    container.style.transform = '';
    container.style.transformOrigin = '';
    if (container.parentElement) {
      container.parentElement.style.height = '';
    }
  }
}
window.addEventListener('resize', resizeGameContainer);

// 滑鼠/觸控拖曳平移與縮放實現
function handlePointerDown(clientX: number, clientY: number) {
  isPointerDown = true;
  startPointerX = clientX;
  startPointerY = clientY;
  isDraggingMap = false;
}

function handlePointerMove(clientX: number, clientY: number) {
  if (!isPointerDown) return;
  const dx = clientX - startPointerX;
  const dy = clientY - startPointerY;

  if (!isDraggingMap && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
    isDraggingMap = true;
  }

  if (isDraggingMap) {
    mapOffsetX += dx;
    mapOffsetY += dy;

    // 限制拖曳邊界，避免完全拖出視野
    const limitX = canvas.width * mapScale - canvas.width;
    const limitY = canvas.height * mapScale - canvas.height;
    mapOffsetX = Math.max(-limitX - 100, Math.min(100, mapOffsetX));
    mapOffsetY = Math.max(-limitY - 100, Math.min(100, mapOffsetY));

    startPointerX = clientX;
    startPointerY = clientY;
  }
}

function handlePointerUp() {
  isPointerDown = false;
}

// 註冊滑鼠事件
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // 左鍵
    handlePointerDown(e.clientX, e.clientY);
  }
});

canvas.addEventListener('mousemove', (e) => {
  handlePointerMove(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
  handlePointerUp();
});

// 註冊觸控事件（包含雙指捏合縮放）
canvas.addEventListener('touchstart', (e) => {
  if (currentScene !== 'BATTLE') return;
  if (e.touches.length === 1) {
    handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    isPointerDown = false;
    isDraggingMap = true; // 雙指操作時禁止下塔
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  if (currentScene !== 'BATTLE') return;
  if (e.touches.length === 1) {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (lastTouchDist > 0) {
      const factor = dist / lastTouchDist;
      const newScale = Math.max(0.5, Math.min(3.0, mapScale * factor));

      const rect = canvas.getBoundingClientRect();
      const rawCenterX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
      const rawCenterY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
      const centerX = rawCenterX * (canvas.width / rect.width);
      const centerY = rawCenterY * (canvas.height / rect.height);

      const worldX = (centerX - mapOffsetX) / mapScale;
      const worldY = (centerY - mapOffsetY) / mapScale;

      mapScale = newScale;
      mapOffsetX = centerX - worldX * mapScale;
      mapOffsetY = centerY - worldY * mapScale;
    }
    lastTouchDist = dist;
  }
}, { passive: true });

canvas.addEventListener('touchend', () => {
  handlePointerUp();
  lastTouchDist = 0;
});

canvas.addEventListener('wheel', (e) => {
  if (currentScene !== 'BATTLE') return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const centerX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const centerY = (e.clientY - rect.top) * (canvas.height / rect.height);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const newScale = Math.max(0.5, Math.min(3.0, mapScale * factor));
  const worldX = (centerX - mapOffsetX) / mapScale;
  const worldY = (centerY - mapOffsetY) / mapScale;
  mapScale = newScale;
  mapOffsetX = centerX - worldX * mapScale;
  mapOffsetY = centerY - worldY * mapScale;
}, { passive: false });

// ============================================================
// 12. 遊戲音效與播控系統 (Phase 4)
// ============================================================

const sfxAssets: Record<string, HTMLAudioElement[]> = {};
const MAX_POOL_SIZE = 10; // 每種音效最多 10 個實例
const sfxPaths: Record<string, string> = {
  click: 'assets/audio/click.mp3',
  shoot: 'assets/audio/shoot.mp3',
  enemy_death: 'assets/audio/enemy_death.mp3',
  merge_success: 'assets/audio/merge_success.mp3'
};

function initSFX() {
  // 預先初始化每種音效的播放池 (池中先放 2 個，後續依需生成)
  for (const [key, path] of Object.entries(sfxPaths)) {
    sfxAssets[key] = [];
    for (let i = 0; i < 2; i++) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      sfxAssets[key].push(audio);
    }
  }
}

function playSFX(type: 'click' | 'shoot' | 'enemy_death' | 'merge_success') {
  if (!isMusicEnabled) return; // 與靜音開關連動
  
  const pool = sfxAssets[type];
  if (!pool) return;
  
  // 1. 尋找池中閒置的 HTMLAudioElement
  let audioToPlay = pool.find(audio => audio.paused || audio.ended);
  
  // 2. 如果都正在播放，且池的大小還沒到上限，則新建一個加入池中
  if (!audioToPlay && pool.length < MAX_POOL_SIZE) {
    audioToPlay = new Audio(sfxPaths[type]);
    audioToPlay.preload = 'auto';
    pool.push(audioToPlay);
  }
  
  // 3. 如果池已滿，則強制複用最舊（第一個）的 HTMLAudioElement
  if (!audioToPlay) {
    audioToPlay = pool[0];
    audioToPlay.pause();
  }
  
  // 4. 播放音效
  audioToPlay.volume = type === 'shoot' ? 0.2 : 0.45;
  audioToPlay.currentTime = 0;
  audioToPlay.play().catch(() => {
    // 默默捕獲錯誤，防止資源不存在或瀏覽器安全策略導致中斷
  });
}

// ============================================================
// 13. 背景音樂輪播與控制 (Phase 4)
// ============================================================

let bgmErrorCount = 0; // 全域變數，紀錄連續 BGM 錯誤次數

function playNextBGM() {
  if (!isMusicEnabled) return;
  stopBGM();

  const track = BGM_PLAYLIST[currentBgmIndex];
  bgmAudio = new Audio(track);
  bgmAudio.volume = 0.35; // 35% 音量

  // 防禦性加載錯誤處理：當前音軌不存在時，自動安全切換至下一首，防止死循環報錯
  bgmAudio.addEventListener('error', () => {
    console.warn(`[BGM] 載入音樂失敗: ${track}。嘗試播放下一首。`);
    stopBGM();
    bgmErrorCount++;
    if (bgmErrorCount >= BGM_PLAYLIST.length) {
      console.error('[BGM] 所有背景音樂皆無法加載，停止背景音樂播放系統。');
      return; 
    }
    currentBgmIndex = (currentBgmIndex + 1) % BGM_PLAYLIST.length;
    playNextBGM();
  });

  bgmAudio.addEventListener('canplaythrough', () => {
    bgmErrorCount = 0; // 成功加載後重置錯誤計數
  }, { once: true });

  bgmAudio.addEventListener('ended', () => {
    // 播放結束後，間隔 5 秒播放下一首
    currentBgmIndex = (currentBgmIndex + 1) % BGM_PLAYLIST.length;
    bgmTimeoutId = setTimeout(() => {
      playNextBGM();
    }, 5000); // 5000 毫秒 = 5 秒
  });

  bgmAudio.play().catch((err) => {
    console.warn('[BGM] 自動播放被瀏覽器阻擋，等待玩家點擊解鎖：', err);
  });
}

function stopBGM() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }
  if (bgmTimeoutId) {
    clearTimeout(bgmTimeoutId);
    bgmTimeoutId = null;
  }
}

// 註冊第一次點擊畫面任何地方以解鎖音訊自動播放
function initBgmUnlocker() {
  const unlock = () => {
    if (hasUserInteracted) return;
    hasUserInteracted = true;
    initSFX(); // 初始化遊戲音效
    playNextBGM();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('touchstart', unlock);
}
initBgmUnlocker();

// 註冊靜音/播控按鈕事件
const btnToggleMusic = document.getElementById('btnToggleMusic')!;
if (btnToggleMusic) {
  btnToggleMusic.addEventListener('click', (e) => {
    e.stopPropagation();
    isMusicEnabled = !isMusicEnabled;
    if (isMusicEnabled) {
      btnToggleMusic.textContent = '🎵';
      btnToggleMusic.style.borderColor = '#6366f1';
      if (hasUserInteracted) {
        playNextBGM();
      }
    } else {
      btnToggleMusic.textContent = '🔇';
      btnToggleMusic.style.borderColor = '#ef4444';
      stopBGM();
    }
  });
}

// 註冊測試調試放怪按鈕事件
const btnSpawnTestMonster = document.getElementById('btnSpawnTestMonster')! as HTMLButtonElement;
const testMonsterSelect = document.getElementById('testMonsterSelect')! as HTMLSelectElement;

btnSpawnTestMonster.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentScene !== 'BATTLE') return;
  playSFX('click');
  const enemyType = testMonsterSelect.value as EnemyTypeId;
  spawnTestEnemy(enemyType);
});

// 初始化版本顯示與更新日誌
function initVersionAndReleaseNotes() {
  const versionEl = document.getElementById('gameVersion');
  if (versionEl) {
    versionEl.textContent = GAME_VERSION;
  }
  
  const btnReleaseNotes = document.getElementById('btnReleaseNotes');
  const releaseNotesModal = document.getElementById('releaseNotesModal');
  const btnCloseReleaseNotes = document.getElementById('btnCloseReleaseNotes');
  const releaseNotesBody = document.getElementById('releaseNotesBody');
  
  if (btnReleaseNotes && releaseNotesModal && releaseNotesBody) {
    btnReleaseNotes.addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      
      // 將 Markdown 格式簡易轉為 HTML (支援標題、清單、粗體、換行)
      const html = releaseNotesText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^# (.*$)/gim, '<h2 style="font-size: 1.4rem; color: var(--gold); margin-top: 16px; margin-bottom: 8px; font-weight:700;">$1</h2>')
        .replace(/^## (.*$)/gim, '<h3 style="font-size: 1.15rem; color: #a5b4fc; margin-top: 14px; margin-bottom: 6px; font-weight:700; border-bottom:1px dashed var(--border-color); padding-bottom:4px;">$1</h3>')
        .replace(/^### (.*$)/gim, '<h4 style="font-size: 1rem; color: var(--text-color); margin-top: 8px; margin-bottom: 4px; font-weight:700;">$1</h4>')
        .replace(/^\s*-\s*(.*$)/gim, '<li style="margin-left: 16px; margin-bottom: 6px; list-style-type: disc;">$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold);">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      
      releaseNotesBody.innerHTML = html;
      releaseNotesModal.style.display = 'flex';
    });
  }
  
  if (btnCloseReleaseNotes && releaseNotesModal) {
    btnCloseReleaseNotes.addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      releaseNotesModal.style.display = 'none';
    });
  }
}
initVersionAndReleaseNotes();


