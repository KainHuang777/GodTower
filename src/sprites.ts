// ============================================================
// src/sprites.ts — 像素美術精靈定義與渲染 (程式碼內建小圖)
// ============================================================
// 每個精靈以 2D 數字陣列定義，數字對應調色盤索引。
// 遊戲初始化時預渲染至 OffscreenCanvas 做為貼圖快取。

import { ENEMY_DEFS, type EnemyTypeId } from './enemies';
import type { TowerTypeId } from './towers';

/** 五行屬性代表色（用於描邊與底盤發光） */
const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444',   // 火：紅色
  water: '#38bdf8',  // 水：冰藍
  wood: '#22c55e',   // 木：翠綠
  earth: '#d97706',  // 土：黃褐
  metal: '#cbd5e1',  // 金：銀灰/白
  yin: '#c084fc',    // 陰：暗紫
  yang: '#fde047',   // 陽：耀眼金黃
};

/** 精靈快取 */
const spriteCache = new Map<string, HTMLCanvasElement>();

/** 圖片資產快取 (Phase 4 高品質美術資源) */
const imageAssetCache = new Map<string, HTMLImageElement>();

/** 預載入單張高品質圖片資產（若載入失敗則維持 Fallback） */
export function preloadImage(key: string, src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      imageAssetCache.set(key, img);
      resolve();
    };
    img.onerror = () => {
      // 載入失敗只輸出警告，不阻礙遊戲啟動，繼續使用預設像素 Fallback
      console.warn(`[Asset Loader] High-res image not found: ${src}, using pixel art fallback.`);
      resolve();
    };
  });
}


/** 像素精靈矩陣型別 */
type SpriteMatrix = number[][];

/** 調色盤 (顏色字串陣列，0 = 透明) */
type Palette = string[];

// ============================================================
// 怪物精靈 (10x10 或 8x8)
// ============================================================

// 小蛇 (木屬性) 10x10 — S 型身軀
const SNAKE_PALETTE: Palette = ['', '#22c55e', '#15803d', '#bbf7d0', '#ef4444'];
const SNAKE_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,3,3,0,0],
  [0,0,0,0,0,3,1,1,3,0],
  [0,0,0,0,3,1,2,2,1,0],
  [0,0,0,3,1,1,0,0,0,0],
  [0,0,3,1,2,0,0,0,0,0],
  [0,3,1,2,0,0,0,0,0,0],
  [0,1,2,0,0,0,0,3,1,0],
  [0,0,0,0,0,0,3,1,2,0],
  [0,0,0,0,0,3,1,2,0,0],
  [0,0,0,0,4,1,2,0,0,0],
];

// 小蒼蠅 (金屬性/飛行) 8x8
const FLY_PALETTE: Palette = ['', '#6b7280', '#374151', '#d1d5db', '#f9fafb'];
const FLY_MATRIX: SpriteMatrix = [
  [0,0,3,0,0,3,0,0],
  [0,3,4,3,3,4,3,0],
  [0,0,3,1,1,3,0,0],
  [0,0,1,2,2,1,0,0],
  [0,1,2,1,1,2,1,0],
  [0,0,1,2,2,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0],
];

// 火蜥蜴 (火屬性) 10x10
const SALAMANDER_PALETTE: Palette = ['', '#ef4444', '#b91c1c', '#fbbf24', '#f97316'];
const SALAMANDER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,3,3,0,0,0,0,0,0],
  [0,3,1,1,2,0,0,0,0,0],
  [0,1,1,2,2,1,0,0,0,0],
  [0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,2,1,1,1,0,0],
  [0,0,0,0,1,0,0,1,1,0],
  [0,0,0,0,0,0,0,0,4,3],
  [0,0,0,0,0,0,0,3,4,0],
  [0,0,0,0,0,0,0,0,3,0],
];

// 水靈 (水屬性) 8x8
const WATER_SPIRIT_PALETTE: Palette = ['', '#38bdf8', '#0284c7', '#bfdbfe', '#e0f2fe'];
const WATER_SPIRIT_MATRIX: SpriteMatrix = [
  [0,0,0,4,0,0,0,0],
  [0,0,4,3,4,0,0,0],
  [0,4,3,1,3,4,0,0],
  [0,3,1,2,1,3,0,0],
  [3,1,2,2,2,1,3,0],
  [0,1,2,1,2,1,0,0],
  [0,0,1,1,1,0,0,0],
  [0,0,0,1,0,0,0,0],
];

// 石傀儡 (土屬性) 12x12
const GOLEM_PALETTE: Palette = ['', '#a8a29e', '#78716c', '#57534e', '#d6d3d1'];
const GOLEM_MATRIX: SpriteMatrix = [
  [0,0,0,0,3,3,3,3,0,0,0,0],
  [0,0,0,3,1,1,1,1,3,0,0,0],
  [0,0,3,1,2,1,1,2,1,3,0,0],
  [0,0,3,1,1,1,1,1,1,3,0,0],
  [0,3,1,1,4,1,1,4,1,1,3,0],
  [0,3,1,1,1,1,1,1,1,1,3,0],
  [3,1,1,1,1,1,1,1,1,1,1,3],
  [3,1,1,2,1,1,1,1,2,1,1,3],
  [0,3,1,1,1,1,1,1,1,1,3,0],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [0,0,1,2,0,0,0,0,2,1,0,0],
  [0,0,3,3,0,0,0,0,3,3,0,0],
];

// 金甲蟲 (金屬性) 10x10
const BEETLE_PALETTE: Palette = ['', '#fbbf24', '#d97706', '#92400e', '#fde68a'];
const BEETLE_MATRIX: SpriteMatrix = [
  [0,0,0,4,4,4,4,0,0,0],
  [0,0,4,1,1,1,1,4,0,0],
  [0,4,1,2,1,1,2,1,4,0],
  [0,1,2,3,2,2,3,2,1,0],
  [1,2,3,3,3,3,3,3,2,1],
  [1,2,3,3,3,3,3,3,2,1],
  [0,1,2,3,2,2,3,2,1,0],
  [0,0,1,2,1,1,2,1,0,0],
  [0,0,0,1,0,0,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
];

// Boss 龍影 (火屬性/飛行) 12x12
const DRAGON_PALETTE: Palette = ['', '#dc2626', '#7c2d12', '#fbbf24', '#f97316', '#fef08a'];
const DRAGON_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,3,3,0,0,0,0,0],
  [0,0,0,0,3,1,1,3,0,0,0,0],
  [5,5,0,3,1,2,2,1,3,0,5,5],
  [0,5,3,1,1,1,1,1,1,3,5,0],
  [0,0,1,2,4,1,1,4,2,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,2,1,1,1,1,1,1,2,1,0],
  [0,1,1,1,2,2,2,2,1,1,1,0],
  [0,0,1,1,0,1,1,0,1,1,0,0],
  [0,0,0,1,0,0,0,0,1,0,0,0],
  [0,0,0,2,0,0,0,0,2,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
];

// 怪物精靈對應表
const ENEMY_SPRITE_MAP: Record<EnemyTypeId, { palette: Palette; matrix: SpriteMatrix }> = {
  snake:        { palette: SNAKE_PALETTE,         matrix: SNAKE_MATRIX },
  fly:          { palette: FLY_PALETTE,           matrix: FLY_MATRIX },
  salamander:   { palette: SALAMANDER_PALETTE,    matrix: SALAMANDER_MATRIX },
  water_spirit: { palette: WATER_SPIRIT_PALETTE,  matrix: WATER_SPIRIT_MATRIX },
  golem:        { palette: GOLEM_PALETTE,         matrix: GOLEM_MATRIX },
  beetle:       { palette: BEETLE_PALETTE,        matrix: BEETLE_MATRIX },
  boss_dragon:  { palette: DRAGON_PALETTE,        matrix: DRAGON_MATRIX },
};

// ============================================================
// 砲台精靈 (16x16) — 簡約底座 + 特徵設計
// ============================================================

// 火塔 🔥
const FIRE_TOWER_PALETTE: Palette = ['', '#991b1b', '#7f1d1d', '#f97316', '#fbbf24', '#fef3c7'];
const FIRE_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,5,4,4,5,0,0,0,0,0,0],
  [0,0,0,0,0,5,4,3,3,4,5,0,0,0,0,0],
  [0,0,0,0,0,4,3,3,3,3,4,0,0,0,0,0],
  [0,0,0,0,4,3,3,4,4,3,3,4,0,0,0,0],
  [0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 水塔 💧
const WATER_TOWER_PALETTE: Palette = ['', '#1e3a5f', '#0c4a6e', '#38bdf8', '#7dd3fc', '#bae6fd'];
const WATER_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,5,4,5,0,0,0,0,0,0,0],
  [0,0,0,0,0,5,4,3,4,5,0,0,0,0,0,0],
  [0,0,0,0,5,4,3,3,3,4,5,0,0,0,0,0],
  [0,0,0,0,0,4,3,4,3,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,4,4,0,0,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 木塔 🌿
const WOOD_TOWER_PALETTE: Palette = ['', '#14532d', '#166534', '#4ade80', '#86efac', '#bbf7d0'];
const WOOD_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,5,0,0,0,0,0,0,0,0,5,0,0,0],
  [0,0,5,4,5,0,0,0,0,0,0,5,4,5,0,0],
  [0,0,0,3,4,5,0,0,0,0,5,4,3,0,0,0],
  [0,0,0,0,3,4,3,0,0,3,4,3,0,0,0,0],
  [0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0],
  [0,0,0,0,0,0,3,3,3,0,0,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 土塔 ⛰️ (純牆壁，石磚紋路)
const EARTH_TOWER_PALETTE: Palette = ['', '#78350f', '#92400e', '#d97706', '#fbbf24'];
const EARTH_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,1,1,1,2,1,1,1,1,2,1,1,1,2,0],
  [0,2,1,3,1,2,1,3,3,1,2,1,3,1,2,0],
  [0,2,1,1,1,2,1,1,1,1,2,1,1,1,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,1,1,1,1,2,1,1,2,1,1,1,1,2,0],
  [0,2,1,3,3,1,2,1,1,2,1,3,3,1,2,0],
  [0,2,1,3,3,1,2,1,1,2,1,3,3,1,2,0],
  [0,2,1,1,1,1,2,1,1,2,1,1,1,1,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,1,1,2,1,1,1,1,1,1,2,1,1,2,0],
  [0,2,1,3,2,1,3,3,3,3,1,2,3,1,2,0],
  [0,2,1,1,2,1,1,1,1,1,1,2,1,1,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 金塔 ⚔️
const METAL_TOWER_PALETTE: Palette = ['', '#374151', '#1f2937', '#e5e7eb', '#f9fafb', '#d1d5db'];
const METAL_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,3,3,4,0,0,0,0,0,0],
  [0,0,0,0,0,4,3,5,5,3,4,0,0,0,0,0],
  [0,0,0,0,0,0,5,3,3,5,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,3,3,4,0,0,0,0,0,0],
  [0,0,0,0,0,4,5,5,5,5,4,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 陰塔 🌑
const YIN_TOWER_PALETTE: Palette = ['', '#2e1065', '#3b0764', '#a855f7', '#c084fc', '#e9d5ff'];
const YIN_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0],
  [0,0,0,0,0,5,4,3,3,4,5,0,0,0,0,0],
  [0,0,0,0,5,4,3,3,3,3,4,5,0,0,0,0],
  [0,0,0,0,0,4,3,4,3,3,4,0,0,0,0,0],
  [0,0,0,0,0,0,4,4,3,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 陽塔 ☀️
const YANG_TOWER_PALETTE: Palette = ['', '#713f12', '#854d0e', '#fbbf24', '#fde047', '#fef9c3'];
const YANG_TOWER_MATRIX: SpriteMatrix = [
  [0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0],
  [0,0,0,5,0,0,5,4,4,5,0,0,5,0,0,0],
  [0,0,0,0,5,5,4,3,3,4,5,5,0,0,0,0],
  [0,0,0,0,0,4,3,3,3,3,4,0,0,0,0,0],
  [0,0,0,5,4,3,3,4,4,3,3,4,5,0,0,0],
  [0,0,0,0,0,4,3,3,3,3,4,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,2,1,1,1,1,2,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
  [0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 砲台精靈對應表
const TOWER_SPRITE_MAP: Record<string, { palette: Palette; matrix: SpriteMatrix }> = {
  fire:  { palette: FIRE_TOWER_PALETTE,  matrix: FIRE_TOWER_MATRIX },
  water: { palette: WATER_TOWER_PALETTE, matrix: WATER_TOWER_MATRIX },
  wood:  { palette: WOOD_TOWER_PALETTE,  matrix: WOOD_TOWER_MATRIX },
  earth: { palette: EARTH_TOWER_PALETTE, matrix: EARTH_TOWER_MATRIX },
  metal: { palette: METAL_TOWER_PALETTE, matrix: METAL_TOWER_MATRIX },
  yin:   { palette: YIN_TOWER_PALETTE,   matrix: YIN_TOWER_MATRIX },
  yang:  { palette: YANG_TOWER_PALETTE,  matrix: YANG_TOWER_MATRIX },
};

// ============================================================
// 預渲染與繪製 API
// ============================================================

/** 將精靈矩陣渲染到 OffscreenCanvas 並快取 */
function prerenderSprite(key: string, palette: Palette, matrix: SpriteMatrix, scale: number = 1): HTMLCanvasElement {
  if (spriteCache.has(key)) return spriteCache.get(key)!;

  const h = matrix.length;
  const w = matrix[0].length;
  const cvs = document.createElement('canvas');
  cvs.width = w * scale;
  cvs.height = h * scale;
  const c = cvs.getContext('2d')!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = matrix[y][x];
      if (idx === 0) continue; // 透明
      c.fillStyle = palette[idx];
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  spriteCache.set(key, cvs);
  return cvs;
}

/** 初始化所有精靈快取（遊戲啟動時呼叫一次） */
export function initSprites(): void {
  // 怪物精靈 (1:1 像素)
  for (const [id, data] of Object.entries(ENEMY_SPRITE_MAP)) {
    prerenderSprite(`enemy_${id}`, data.palette, data.matrix, 1);
  }
  // 砲台精靈 (1:1 → 16x16)
  for (const [id, data] of Object.entries(TOWER_SPRITE_MAP)) {
    prerenderSprite(`tower_${id}`, data.palette, data.matrix, 1);
  }
}

/** 繪製怪物精靈 */
export function drawEnemySprite(
  ctx: CanvasRenderingContext2D, 
  enemyType: EnemyTypeId, 
  x: number, 
  y: number,
  hitFlashFrame: number = 0,
  scale: number = 1,
  style: string = 'pixel'
): void {
  const imgKey = `enemy_${enemyType}`;
  const img = imageAssetCache.get(imgKey);
  
  // 取得怪物屬性顏色
  const def = ENEMY_DEFS[enemyType];
  const elementColor = def ? ELEMENT_COLORS[def.element] : '#ffffff';

  ctx.save();

  // 只有當選擇 AI 高清 (style === 'highres') 且圖片載入成功時才使用 SD 圖片
  if (style === 'highres' && img && img.complete && img.naturalWidth !== 0) {
    // 普通怪物對齊 1 格寬 (16px)，Boss 龍影放大至 26px，並乘上縮放係數
    const targetSize = (enemyType.startsWith('boss') ? 26 : 16) * scale;

    if (hitFlashFrame > 0) {
      // 受擊狀態：耀眼的紅/白受擊外發光 + 整個身體閃爍白色
      ctx.filter = 'brightness(2.5) contrast(1.5) drop-shadow(0 0 3px #ff3b30)';
    } else {
      // 正常狀態：屬性色 1px 硬外描邊 + 輕微立體落影，改善四角邊緣死板感
      ctx.filter = `drop-shadow(1px 0px 0px ${elementColor}) drop-shadow(-1px 0px 0px ${elementColor}) drop-shadow(0px 1px 0px ${elementColor}) drop-shadow(0px -1px 0px ${elementColor}) drop-shadow(0px 2px 2px rgba(0,0,0,0.35))`;
    }

    ctx.drawImage(img, x - targetSize / 2, y - targetSize / 2, targetSize, targetSize);
    ctx.restore();
    return;
  }

  // Fallback: 原始內建像素精靈
  const cvs = spriteCache.get(imgKey);
  if (cvs) {
    if (hitFlashFrame > 0) {
      ctx.filter = 'brightness(2.5) contrast(1.5) drop-shadow(0 0 3px #ff3b30)';
    } else {
      ctx.filter = `drop-shadow(1px 0px 0px ${elementColor}) drop-shadow(-1px 0px 0px ${elementColor}) drop-shadow(0px 1px 0px ${elementColor}) drop-shadow(0px -1px 0px ${elementColor})`;
    }
    // 依據比例繪製 fallback 像素圖
    ctx.drawImage(cvs, x - (cvs.width * scale) / 2, y - (cvs.height * scale) / 2, cvs.width * scale, cvs.height * scale);
    ctx.restore();
  }
}

/** 繪製砲台精靈 */
export function drawTowerSprite(ctx: CanvasRenderingContext2D, towerType: TowerTypeId, x: number, y: number, scale: number = 1, style: string = 'pixel'): void {
  // 合成塔暫用基礎屬性的精靈（加上 Lv 標記）
  let baseType = towerType.replace(/_2$/, '').split('_')[0];
  // 異系合成塔映射到第一個輸入屬性的精靈
  const recipeMap: Record<string, string> = {
    'wood_fire': 'fire', 'fire_earth': 'earth', 'earth_metal': 'metal',
    'metal_water': 'water', 'water_wood': 'wood', 'yin_yang': 'yin',
    'yin_element': 'yin', 'yang_element': 'yang'
  };
  if (recipeMap[towerType]) baseType = recipeMap[towerType];

  const imgKey = `tower_${towerType}`; // 優先搜尋特定型號的高品質圖 (例如 fire_2)
  let img = imageAssetCache.get(imgKey);
  if (!img) {
    img = imageAssetCache.get(`tower_${baseType}`); // 其次搜尋基礎型號 (例如 fire)
  }

  // 1. 繪製半透明五行屬性底座 (3D 透視橢圓)
  const elementColor = ELEMENT_COLORS[baseType] ?? '#ffffff';
  ctx.save();
  ctx.beginPath();
  // 16x16 網格中心為 x + 8 * scale, y + 12 * scale，底盤繪製於地表略偏下方 (y + 12)，並乘上縮放係數
  ctx.ellipse(x + 8 * scale, y + 12 * scale, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = elementColor + '22';     // ~13% 透明度填充
  ctx.fill();
  ctx.strokeStyle = elementColor + '88';   // ~53% 透明度描邊
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();
  ctx.restore();

  // 2. 繪製防禦塔主體
  // 只有當選擇 AI 高清 (style === 'highres') 且圖片載入成功時才使用 SD 圖片
  if (style === 'highres' && img && img.complete && img.naturalWidth !== 0) {
    ctx.save();
    // 使用 Canvas filter 硬體加速：加上 1px 半透明黑色外描邊與微弱投影，使其不再只是死板的透明四角貼圖
    ctx.filter = 'drop-shadow(1px 0px 0px rgba(0,0,0,0.65)) drop-shadow(-1px 0px 0px rgba(0,0,0,0.65)) drop-shadow(0px 1px 0px rgba(0,0,0,0.65)) drop-shadow(0px -1px 0px rgba(0,0,0,0.65)) drop-shadow(0px 3px 2px rgba(0,0,0,0.4))';
    
    // 限制寬度為 1 格寬 (16*scale) 以免交疊，高度 22*scale 以保留立體感，偏移 y - 6*scale
    ctx.drawImage(img, x, y - 6 * scale, 16 * scale, 22 * scale);
    ctx.restore();
    drawTowerLevelStars(ctx, towerType, x, y, recipeMap, scale);
    return;
  }

  // Fallback: 原始內建像素精靈
  const cvs = spriteCache.get(`tower_${baseType}`);
  if (cvs) {
    ctx.save();
    // 像素 Fallback 精靈亦套用 1px 外描邊以增強對比，並依據比例繪製
    ctx.filter = 'drop-shadow(1px 0px 0px rgba(0,0,0,0.45)) drop-shadow(-1px 0px 0px rgba(0,0,0,0.45)) drop-shadow(0px 1px 0px rgba(0,0,0,0.45)) drop-shadow(0px -1px 0px rgba(0,0,0,0.45))';
    ctx.drawImage(cvs, x, y, cvs.width * scale, cvs.height * scale);
    ctx.restore();
    drawTowerLevelStars(ctx, towerType, x, y, recipeMap, scale);
  }
}

/** 繪製防禦塔星級 (等級標記) */
function drawTowerLevelStars(
  ctx: CanvasRenderingContext2D, 
  towerType: TowerTypeId, 
  x: number, 
  y: number,
  recipeMap: Record<string, string>,
  scale: number = 1
): void {
  const level = towerType.endsWith('_2') ? 2 : (recipeMap[towerType] ? 3 : 1);
  if (level > 1) {
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold ' + Math.round(8 * scale) + 'px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('★'.repeat(Math.min(level, 3)), x + 15 * scale, y + 8 * scale);
  }
}

