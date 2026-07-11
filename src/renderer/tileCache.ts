// src/renderer/tileCache.ts — 靜態地磚與網格線 Offscreen Canvas 預渲染快取

import { gameState } from '../state';
import { drawTile } from '../sprites';

let tileCacheCanvas: HTMLCanvasElement | null = null;

/** 取得當前背景與網格主題配色 */
function getThemeColors(theme: string) {
  let bgFillStyle = '#020617';
  let gridStrokeStyle = '#1e293b';

  if (theme === 'chinese') {
    bgFillStyle = '#2b0909';
    gridStrokeStyle = '#6b1d1d';
  } else if (theme === 'ink') {
    bgFillStyle = '#f8fafc';
    gridStrokeStyle = '#e2e8f0';
  } else if (theme === 'starry') {
    bgFillStyle = '#060a16';
    gridStrokeStyle = '#131e3a';
  }

  return { bgFillStyle, gridStrokeStyle };
}

/** 預渲染靜態地板、路徑與網格線 */
export function updateTileCacheCanvas() {
  if (!tileCacheCanvas) {
    tileCacheCanvas = document.createElement('canvas');
  }

  const width = gameState.COLS * gameState.TILE_SIZE;
  const height = gameState.ROWS * gameState.TILE_SIZE;

  // 避免尺寸相同但重複重置 Canvas 導致快取失效
  if (tileCacheCanvas.width !== width || tileCacheCanvas.height !== height) {
    tileCacheCanvas.width = width;
    tileCacheCanvas.height = height;
  }

  const ctx = tileCacheCanvas.getContext('2d');
  if (!ctx) return;

  const { bgFillStyle, gridStrokeStyle } = getThemeColors(gameState.currentTheme);

  // 1. 繪製背景色
  ctx.fillStyle = bgFillStyle;
  ctx.fillRect(0, 0, width, height);

  // 2. 繪製平鋪地板與路徑 Tile
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      const isPath = gameState.cachedPathTiles.has(`${x},${y}`);
      drawTile(ctx, gameState.currentTheme, isPath, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.TILE_SIZE / 16, x, y);
    }
  }

  // 3. 繪製靜態網格線
  ctx.strokeStyle = gridStrokeStyle;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= gameState.COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * gameState.TILE_SIZE, 0);
    ctx.lineTo(x * gameState.TILE_SIZE, gameState.ROWS * gameState.TILE_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= gameState.ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * gameState.TILE_SIZE);
    ctx.lineTo(gameState.COLS * gameState.TILE_SIZE, y * gameState.TILE_SIZE);
    ctx.stroke();
  }
}

/** 獲取預渲染完成的瓦片 Canvas。若尚未建立則自動觸發預渲染 */
export function getTileCacheCanvas(): HTMLCanvasElement {
  if (!tileCacheCanvas) {
    updateTileCacheCanvas();
  }
  return tileCacheCanvas!;
}
