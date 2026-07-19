// src/renderer/tileAutotile.ts — 由有序路線建立四方向組合地塊

import type { Point } from '../types';

export const ROUTE_NORTH = 1;
export const ROUTE_EAST = 2;
export const ROUTE_SOUTH = 4;
export const ROUTE_WEST = 8;

export type RouteMaskMap = Map<string, number>;

function key(point: Point): string {
  return `${point.x},${point.y}`;
}

function connect(masks: RouteMaskMap, point: Point, bit: number): void {
  const pointKey = key(point);
  masks.set(pointKey, (masks.get(pointKey) ?? 0) | bit);
}

/**
 * 只依「路徑中的連續步驟」建立連接；附近但未實際相連的道路不會被誤判為岔路。
 */
export function buildRouteMasks(path: readonly Point[]): RouteMaskMap {
  const masks: RouteMaskMap = new Map();
  for (const point of path) masks.set(key(point), masks.get(key(point)) ?? 0);

  for (let index = 1; index < path.length; index++) {
    const previous = path[index - 1];
    const current = path[index];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) continue;

    if (dx === 1) {
      connect(masks, previous, ROUTE_EAST);
      connect(masks, current, ROUTE_WEST);
    } else if (dx === -1) {
      connect(masks, previous, ROUTE_WEST);
      connect(masks, current, ROUTE_EAST);
    } else if (dy === 1) {
      connect(masks, previous, ROUTE_SOUTH);
      connect(masks, current, ROUTE_NORTH);
    } else {
      connect(masks, previous, ROUTE_NORTH);
      connect(masks, current, ROUTE_SOUTH);
    }
  }

  return masks;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  mask: number,
  ratio: number,
  color: string,
): void {
  const width = Math.max(2, Math.round(size * ratio));
  const inset = Math.round((size - width) / 2);
  const centerX = px + inset;
  const centerY = py + inset;
  const half = Math.ceil(size / 2);

  ctx.fillStyle = color;
  ctx.fillRect(centerX, centerY, width, width);
  if (mask & ROUTE_NORTH) ctx.fillRect(centerX, py, width, half + inset);
  if (mask & ROUTE_EAST) ctx.fillRect(px + half, centerY, size - half, width);
  if (mask & ROUTE_SOUTH) ctx.fillRect(centerX, py + half, width, size - half);
  if (mask & ROUTE_WEST) ctx.fillRect(px, centerY, half + inset, width);
}

function appendRoadShape(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  mask: number,
  ratio: number,
): void {
  const width = Math.max(2, Math.round(size * ratio));
  const inset = Math.round((size - width) / 2);
  const centerX = px + inset;
  const centerY = py + inset;
  const half = Math.ceil(size / 2);
  ctx.rect(centerX, centerY, width, width);
  if (mask & ROUTE_NORTH) ctx.rect(centerX, py, width, half + inset);
  if (mask & ROUTE_EAST) ctx.rect(px + half, centerY, size - half, width);
  if (mask & ROUTE_SOUTH) ctx.rect(centerX, py + half, width, size - half);
  if (mask & ROUTE_WEST) ctx.rect(px, centerY, half + inset, width);
}

function fillRoadTexture(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  mask: number,
  texture: CanvasPattern,
): void {
  ctx.save();
  ctx.beginPath();
  appendRoadShape(ctx, px, py, size, mask, 0.76);
  ctx.clip();
  ctx.fillStyle = texture;
  ctx.fillRect(px, py, size, size);
  // 輕微暖色覆蓋，讓取樣紋理與目前的東方草地色溫一致。
  ctx.fillStyle = 'rgba(225, 163, 75, 0.18)';
  ctx.fillRect(px, py, size, size);
  ctx.restore();
}

function isInsideRoad(px: number, py: number, size: number, mask: number, ratio: number): boolean {
  const width = Math.max(2, Math.round(size * ratio));
  const inset = Math.round((size - width) / 2);
  const centerEnd = inset + width;
  const inCenter = px >= inset && px < centerEnd && py >= inset && py < centerEnd;
  if (inCenter) return true;
  if ((mask & ROUTE_NORTH) && px >= inset && px < centerEnd && py < size / 2) return true;
  if ((mask & ROUTE_EAST) && py >= inset && py < centerEnd && px >= size / 2) return true;
  if ((mask & ROUTE_SOUTH) && px >= inset && px < centerEnd && py >= size / 2) return true;
  return Boolean((mask & ROUTE_WEST) && py >= inset && py < centerEnd && px < size / 2);
}

function roadHash(gridX: number, gridY: number, salt: number): number {
  return Math.abs((gridX * 92821 + gridY * 68917 + salt * 283) % 997);
}

/**
 * 無縫像素土路：所有道路方向由同一套幾何與材質層繪製。
 * 不依賴生成圖集的角落邊緣，避免直線、轉角與三岔在格線交界出現位移。
 */
export function drawChineseRoadTile(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  mask: number,
  gridX: number,
  gridY: number,
  texture: CanvasPattern | null = null,
): void {
  drawLayer(ctx, px, py, size, mask, 0.94, '#3d6e35');
  drawLayer(ctx, px, py, size, mask, 0.86, '#65452b');
  if (texture) {
    fillRoadTexture(ctx, px, py, size, mask, texture);
    return;
  }

  // 素材缺失時維持不影響遊玩的無縫低彩度回退道路。
  drawLayer(ctx, px, py, size, mask, 0.76, '#9b6938');
  drawLayer(ctx, px, py, size, mask, 0.66, '#c28a47');
  drawLayer(ctx, px, py, size, mask, 0.52, '#daa45b');

  // 固定 hash 的碎石與明亮土粒，不使用隨機數，讓快取重建後仍保持一致。
  const pebble = Math.max(1, Math.floor(size / 18));
  for (let index = 0; index < 7; index++) {
    const localX = 8 + (roadHash(gridX, gridY, index) % Math.max(1, size - 16));
    const localY = 8 + (roadHash(gridX, gridY, index + 11) % Math.max(1, size - 16));
    if (!isInsideRoad(localX, localY, size, mask, 0.62)) continue;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(104, 70, 38, 0.48)' : 'rgba(249, 210, 132, 0.45)';
    ctx.fillRect(px + localX, py + localY, pebble, pebble);
  }
}
