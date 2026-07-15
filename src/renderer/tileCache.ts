// src/renderer/tileCache.ts — 靜態地磚與網格線 Offscreen Canvas 預渲染快取

import { gameState } from '../state';
import { drawTile } from '../sprites';
import { drawObstacle } from './drawObstacle';

let tileCacheCanvas: HTMLCanvasElement | null = null;

/** 取得當前背景與網格主題配色 */
function getThemeColors(theme: string) {
  let bgFillStyle = '#020617';
  let gridStrokeStyle = '#1e293b';

  if (theme === 'chinese') {
    bgFillStyle = '#A9C978';
    gridStrokeStyle = 'rgba(58, 78, 42, 0.22)';
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
      drawTile(ctx, gameState.currentTheme, gameState.currentTheme === 'chinese' ? false : isPath, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.TILE_SIZE / 16, x, y);
      if (gameState.currentTheme !== 'chinese' && gameState.grid[x][y] === 2) {
        drawObstacle(ctx, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.currentTheme, gameState.TILE_SIZE);
      }
    }
  }

  // 中式標準關卡使用連續圓角道路。尋路仍是整數網格，只有視覺跨格平滑。
  if (gameState.currentTheme === 'chinese' && gameState.cachedFullPath.length > 1) {
    const points = gameState.cachedFullPath;
    const T = gameState.TILE_SIZE;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x * T + T / 2, points[0].y * T + T / 2);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * T + T / 2, points[i].y * T + T / 2);
    }
    // 寬闊暖土路：草邊 → 深土邊緣 → 明亮中央，視覺密度與塔身同步提升。
    ctx.strokeStyle = '#70934F';
    ctx.lineWidth = T * 1.20;
    ctx.stroke();
    ctx.strokeStyle = '#8A603D';
    ctx.lineWidth = T * 1.08;
    ctx.stroke();
    ctx.strokeStyle = '#C99B61';
    ctx.lineWidth = T * 0.92;
    ctx.stroke();
    ctx.strokeStyle = '#E4C487';
    ctx.lineWidth = T * 0.70;
    ctx.stroke();
    ctx.setLineDash([T * 0.14, T * 0.42]);
    ctx.strokeStyle = 'rgba(104, 70, 40, 0.28)';
    ctx.lineWidth = Math.max(1, T * 0.06);
    ctx.stroke();
    ctx.restore();
  }

  // 道路完成後再放置天然地形，確保灌木與山石有完整輪廓。
  if (gameState.currentTheme === 'chinese') {
    for (let x = 0; x < gameState.COLS; x++) {
      for (let y = 0; y < gameState.ROWS; y++) {
        if (gameState.grid[x][y] === 2) {
          drawObstacle(ctx, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.currentTheme, gameState.TILE_SIZE);
        }
      }
    }
  }

  // 3. 非標準日間主題保留網格；中式關卡以連續地景呈現，建造時另有游標格提示。
  if (gameState.currentTheme !== 'chinese') {
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
}

/** 獲取預渲染完成的瓦片 Canvas。若尚未建立則自動觸發預渲染 */
export function getTileCacheCanvas(): HTMLCanvasElement {
  if (!tileCacheCanvas) {
    updateTileCacheCanvas();
  }
  return tileCacheCanvas!;
}
