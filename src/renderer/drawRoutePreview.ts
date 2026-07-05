// ============================================================
// src/renderer/drawRoutePreview.ts — 路線預覽繪製
// ============================================================

import type { Point } from '../types';

export function drawRoutePreview(
  ctx: CanvasRenderingContext2D,
  cachedPreviewRoute: Point[],
  TILE_SIZE: number,
  routePreviewTimer: number
) {
  if (cachedPreviewRoute.length === 0) {
    return;
  }

  const routeScale = TILE_SIZE / 16;
  ctx.save();

  ctx.lineWidth = 4 * routeScale;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
  ctx.shadowBlur = 8 * routeScale;
  ctx.shadowColor = '#f59e0b';

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

  ctx.lineWidth = 2 * routeScale;
  ctx.strokeStyle = '#ffffff';
  ctx.setLineDash([6 * routeScale, 12 * routeScale]);
  ctx.lineDashOffset = -(Date.now() / 15) * routeScale;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 4 * routeScale;
  ctx.shadowColor = '#fbbf24';

  const arrowSpacing = 48 * routeScale;
  const arrowSize = 4 * routeScale;
  const animOffset = (Date.now() / 15) % arrowSpacing;

  for (let i = 0; i < cachedPreviewRoute.length - 1; i++) {
    const x1 = cachedPreviewRoute[i].x * TILE_SIZE + TILE_SIZE / 2;
    const y1 = cachedPreviewRoute[i].y * TILE_SIZE + TILE_SIZE / 2;
    const x2 = cachedPreviewRoute[i + 1].x * TILE_SIZE + TILE_SIZE / 2;
    const y2 = cachedPreviewRoute[i + 1].y * TILE_SIZE + TILE_SIZE / 2;

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
