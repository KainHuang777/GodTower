// src/renderer/tileCache.ts — 靜態地磚與網格線 Offscreen Canvas 預渲染快取

import { gameState } from '../state';
import { drawTile } from '../sprites';
import { drawObstacle } from './drawObstacle';
import { buildRouteMasks, drawChineseRoadTile } from './tileAutotile';
import { drawMeadowBase, drawRoadAutotileTile, drawTerrainProp, getAtlasRoadDirtPattern, getChineseTerrainAssets } from './terrainAssets';

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
  ctx.imageSmoothingEnabled = false;

  const { bgFillStyle, gridStrokeStyle } = getThemeColors(gameState.currentTheme);
  const terrainAssets = gameState.currentTheme === 'chinese'
    ? getChineseTerrainAssets(updateTileCacheCanvas)
    : null;
  const roadDirtPattern = gameState.currentTheme === 'chinese'
    ? getAtlasRoadDirtPattern(ctx, terrainAssets?.atlas ?? null)
    : null;

  // 1. 繪製背景色
  ctx.fillStyle = bgFillStyle;
  ctx.fillRect(0, 0, width, height);
  if (terrainAssets?.meadowBase) {
    drawMeadowBase(ctx, terrainAssets.meadowBase, width, height);
  }

  // 2. 未載入高細節草地時才使用原生像素地板；確保資產失敗也能正常遊玩。
  const routeMasks = gameState.currentTheme === 'chinese'
    ? buildRouteMasks(gameState.cachedFullPath)
    : new Map<string, number>();
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      const isPath = gameState.cachedPathTiles.has(`${x},${y}`);
      if (gameState.currentTheme !== 'chinese' || !terrainAssets?.meadowBase) {
        drawTile(ctx, gameState.currentTheme, gameState.currentTheme === 'chinese' ? false : isPath, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.TILE_SIZE / 16, x, y);
      }
      if (gameState.currentTheme !== 'chinese' && gameState.grid[x][y] === 2) {
        drawObstacle(ctx, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.currentTheme, gameState.TILE_SIZE);
      }
    }
  }

  if (gameState.currentTheme === 'chinese' && terrainAssets?.atlas) {
    for (const prop of gameState.currentMap.presentation?.terrainProps ?? []) {
      if (!gameState.cachedPathTiles.has(`${prop.x},${prop.y}`)) {
        drawTerrainProp(ctx, terrainAssets.atlas, prop.atlasCell, prop.x * gameState.TILE_SIZE, prop.y * gameState.TILE_SIZE, gameState.TILE_SIZE);
      }
    }
  }

  // 3. 道路永遠由目前的有序路徑重組。專用 autotile 的每個出口都在固定中心線，
  //    因此直線、轉角與岔路可以直接無縫拼接。
  if (gameState.currentTheme === 'chinese') {
    for (let x = 0; x < gameState.COLS; x++) {
      for (let y = 0; y < gameState.ROWS; y++) {
        if (!gameState.cachedPathTiles.has(`${x},${y}`)) continue;
        const mask = routeMasks.get(`${x},${y}`) ?? 0;
        const usedRoadAtlas = drawRoadAutotileTile(
          ctx,
          terrainAssets?.roadAtlas ?? null,
          x * gameState.TILE_SIZE,
          y * gameState.TILE_SIZE,
          gameState.TILE_SIZE,
          mask,
        );
        if (!usedRoadAtlas) {
          drawChineseRoadTile(
            ctx,
            x * gameState.TILE_SIZE,
            y * gameState.TILE_SIZE,
            gameState.TILE_SIZE,
            mask,
            x,
            y,
            roadDirtPattern,
          );
        }
      }
    }
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

  // 4. 非標準日間主題保留網格；中式關卡以連續地景呈現，建造時另有游標格提示。
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
