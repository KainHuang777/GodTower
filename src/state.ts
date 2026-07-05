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
    waveTotal: 0,
    waveSpawned: 0,

    currentTheme: 'scifi',
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
  };
}

/** 執行期單例；main.ts 初始化時會再依選擇關卡覆寫部分欄位 */
export const gameState = createGameState();
