// ============================================================
// src/state.ts — 全局可變遊戲狀態
// ============================================================
//
// 本檔案由 main.ts 模組化拆分而來，集中所有原本在 main.ts 頂層的 let 狀態。
// 採用單例模式（singleton）以最小化行為變更；未來可依 concern 進一步拆分。

import type {
  Point, Enemy, Tower, Bullet, FloatingText, TempWall, Particle,
  BgStar, WeatherParticle, GameScene, EditorTool, ThemeId, WeatherId,
} from './types';
import { MAPS } from './maps';
import type { MapConfig } from './maps';
import type { TalentSaveData } from './talent';
import type { Element } from './towers';

/** Roguelike Buff 狀態（每局重置） */
export interface RoguelikeState {
  /** 各元素傷害加成倍率（0.0 = 無加成），最多疊加 2 層 */
  elementDmgBonus: Partial<Record<Element, number>>;
  /** 下次合成費用倍率（1.0 = 正常，0.5 = 半價） */
  nextMergeCostPct: number;
  /** 全場射程加成格數 */
  rangeBonusGlobal: number;
  /** 攻速加成（攻速冷卻縮短幀數，0 = 無） */
  attackSpeedBonus: number;
  /** 攻速加成剩餘波次（0 = 無效果） */
  attackSpeedWavesLeft: number;
  /** 下次建塔免費 */
  freeNextBuild: boolean;
  /** 神秘召喚當前定價（每局開始時計算一次） */
  mysteryBoxPrice: number;
}

export interface GameState {
  // 地圖尺寸（會隨關卡改變）
  COLS: number;
  ROWS: number;
  TILE_SIZE: number;

  // 地圖設定
  currentMap: MapConfig;
  SPAWN_POINT: Point;
  BASE_POINT: Point;
  WAYPOINTS: Point[];

  // 場景
  currentScene: GameScene;
  animFrameId: number | null;

  // 地圖編輯器
  editorTool: EditorTool;
  editorGrid: number[][];
  editorSpawn: Point | null;
  editorBase: Point | null;
  editorWaypoints: Point[];
  editorAnimId: number | null;
  editorMouseDown: boolean;

  // 戰鬥狀態
  hp: number;
  gold: number;
  wave: number;
  killCount: number;
  isWaveActive: boolean;
  talentData: TalentSaveData;
  totalDamageDealt: number;
  currentKillStreak: number;
  maxKillStreak: number;
  grid: number[][];
  currentStyle: 'pixel' | 'highres';

  // 實體
  enemies: Enemy[];
  towers: Tower[];
  bullets: Bullet[];
  floatingTexts: FloatingText[];
  tempWalls: TempWall[];
  particles: Particle[];
  nextEnemyId: number;
  nextTowerId: number;

  // 工具 / 合成
  selectedTool: string;
  mergeMode: boolean;
  mergeFirstTower: Tower | null;

  // 波次 / 預覽
  spawnTimers: ReturnType<typeof setInterval>[];
  routePreviewTimer: number;
  cachedPreviewRoute: Point[];
  cachedPathTiles: Set<string>;
  cachedFullPath: Point[];
  waveTotal: number;
  waveSpawned: number;

  // 主題 / 天氣
  currentTheme: ThemeId;
  currentWeather: WeatherId;
  bgStars: BgStar[];
  weatherParticles: WeatherParticle[];
  lightningTimer: number;
  lightningActive: number;
  lightningPaths: Point[][];

  // 地圖平移 / 縮放 / 輸入
  mapScale: number;
  mapOffsetX: number;
  mapOffsetY: number;
  isDraggingMap: boolean;
  isPointerDown: boolean;
  startPointerX: number;
  startPointerY: number;
  lastTouchDist: number;

  // 診斷 / 效能
  drawCallCount: number;
  isDiagnosticOpen: boolean;
  lastFpsUpdateTime: number;
  frameCount: number;
  currentFps: number;

  // 基準測試 (Benchmark) 狀態
  isBenchmarking: boolean;
  benchStartTime: number;
  benchFrames: number[];
  benchDrawCalls: number[];

  // 跨模組回呼函式
  switchScene?: (scene: GameScene) => void;
  startBattle?: () => void;
  renderTalentScreen?: () => void;
  renderLevelSelectScreen?: () => void;
  refreshMenuTalentInfo?: () => void;
  initEditor?: () => void;
  renderEditor?: () => void;
  spawnWave?: (waveNum: number) => void;
  spawnTestEnemy?: (enemyType: any) => void;
  updateUI?: () => void;
  updateWaveProgress?: () => void;
  buildTowerButtons?: () => void;
  refreshToolSelection?: () => void;
  resizeGameContainer?: () => void;
  startPerformanceBenchmark?: () => void;
  endPerformanceBenchmark?: () => void;

    // Juice & Range Visualization
    hitStopFrames: number;
    shakeIntensity: number;
    shakeDecay: number;
    hoverGridX: number | null;
    hoverGridY: number | null;
    selectedTower: Tower | null;
    gameSpeed: number;
    hoveredTowerBtn: string | null;
    draggedTowerTypeId: string | null;
    dragMousePos: Point | null;
    
    // P2 features
    waveTicks: number; // Wave duration frame counter
    mergeTutorialState: 'idle' | 'active' | 'completed'; // Merge tutorial flow
    mergeTutorialTowers: number[]; // Towers highlighted for merging tutorial

    // P3 features
    mergeAnimation: {
      active: boolean;
      timer: number;
      duration: number;
      t1: { x: number, y: number, typeId: string };
      t2: { x: number, y: number, typeId: string };
      resultX: number;
      resultY: number;
      resultTypeId: string;
    } | null;
    talentTutorialActive: boolean;
    levelTutorialStep: 'idle' | 'intro' | 'build_wall' | 'build_tower' | 'start_wave' | 'wave_1_active' | 'merge_guide' | 'speed_guide' | 'wave_5_guide' | 'completed';
    activeTalentTrack: 'track-base' | 'track-attack' | 'track-element' | 'track-yinyang';

    // Roguelike 系統狀態
    roguelikeState: RoguelikeState;
}

function createInitialGrid(cols: number, rows: number): number[][] {
  return Array.from({ length: cols }, () => Array(rows).fill(0));
}

export function createGameState(): GameState {
  return {
    COLS: 80,
    ROWS: 40,
    TILE_SIZE: 16,

    currentMap: MAPS[1],
    SPAWN_POINT: { x: 0, y: 20 },
    BASE_POINT: { x: 79, y: 20 },
    WAYPOINTS: [
      { x: 13, y: 8 }, { x: 26, y: 32 }, { x: 40, y: 8 }, { x: 53, y: 32 }, { x: 66, y: 15 }
    ],

    currentScene: 'MAIN_MENU',
    animFrameId: null,

    editorTool: 'obstacle',
    editorGrid: [],
    editorSpawn: null,
    editorBase: null,
    editorWaypoints: [],
    editorAnimId: null,
    editorMouseDown: false,

    hp: 20,
    gold: 60,
    wave: 0,
    killCount: 0,
    isWaveActive: false,
    talentData: {} as TalentSaveData,
    totalDamageDealt: 0,
    currentKillStreak: 0,
    maxKillStreak: 0,
    grid: createInitialGrid(80, 40),
    currentStyle: 'pixel',

    enemies: [],
    towers: [],
    bullets: [],
    floatingTexts: [],
    tempWalls: [],
    particles: [],
    nextEnemyId: 1,
    nextTowerId: 1,

    selectedTool: 'earth',
    mergeMode: false,
    mergeFirstTower: null,

    spawnTimers: [],
    routePreviewTimer: 0,
    cachedPreviewRoute: [],
    cachedPathTiles: new Set<string>(),
    cachedFullPath: [],
    waveTotal: 0,
    waveSpawned: 0,

    currentTheme: 'chinese',
    currentWeather: 'none',
    bgStars: [],
    weatherParticles: [],
    lightningTimer: 0,
    lightningActive: 0,
    lightningPaths: [],

    mapScale: 1.0,
    mapOffsetX: 0,
    mapOffsetY: 0,
    isDraggingMap: false,
    isPointerDown: false,
    startPointerX: 0,
    startPointerY: 0,
    lastTouchDist: 0,

    drawCallCount: 0,
    isDiagnosticOpen: false,
    lastFpsUpdateTime: 0,
    frameCount: 0,
    currentFps: 60,
    isBenchmarking: false,
    benchStartTime: 0,
    benchFrames: [],
    benchDrawCalls: [],

    // Juice & Range Visualization
    hitStopFrames: 0,
    shakeIntensity: 0,
    shakeDecay: 0,
    hoverGridX: null,
    hoverGridY: null,
    selectedTower: null,
    gameSpeed: 1,
    hoveredTowerBtn: null,
    draggedTowerTypeId: null,
    dragMousePos: null,
    
    // P2 features
    waveTicks: 0,
    mergeTutorialState: (typeof window !== 'undefined' && window.localStorage.getItem('td_shown_merge_tutorial') === 'true') ? 'completed' : 'idle',
    mergeTutorialTowers: [],

    // P3 合成動畫與新手引導
    mergeAnimation: null,
    talentTutorialActive: false,
    levelTutorialStep: 'idle',
    activeTalentTrack: 'track-base',

    // Roguelike 系統狀態
    roguelikeState: {
      elementDmgBonus: {},
      nextMergeCostPct: 1.0,
      rangeBonusGlobal: 0,
      attackSpeedBonus: 0,
      attackSpeedWavesLeft: 0,
      freeNextBuild: false,
      mysteryBoxPrice: 0,
    },
  };
}

/** 執行期單例；main.ts 初始化時會再依選擇關卡覆寫部分欄位 */
export const gameState = createGameState();
