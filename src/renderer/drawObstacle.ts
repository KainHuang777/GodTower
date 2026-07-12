// ============================================================
// src/renderer/drawObstacle.ts — 場景主題障礙物繪製
// ============================================================

import type { ThemeId } from '../types';

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  currentTheme: ThemeId,
  TILE_SIZE: number
) {
  ctx.save();
  if (currentTheme === 'scifi') {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
  } else if (currentTheme === 'chinese') {
    const u = TILE_SIZE / 16;
    const variant = (Math.floor(x / TILE_SIZE) * 7 + Math.floor(y / TILE_SIZE) * 11) % 3;
    ctx.fillStyle = 'rgba(58, 37, 27, 0.28)';
    ctx.fillRect(x + 3 * u, y + 12 * u, 11 * u, 3 * u);
    if (variant === 0) {
      ctx.fillStyle = '#526C3D';
      ctx.fillRect(x + 2 * u, y + 7 * u, 13 * u, 6 * u);
      ctx.fillRect(x + 5 * u, y + 3 * u, 8 * u, 10 * u);
      ctx.fillStyle = '#789A4D';
      ctx.fillRect(x + 3 * u, y + 6 * u, 5 * u, 5 * u);
      ctx.fillRect(x + 9 * u, y + 4 * u, 4 * u, 6 * u);
    } else if (variant === 1) {
      ctx.fillStyle = '#6E765B';
      ctx.fillRect(x + 2 * u, y + 8 * u, 6 * u, 5 * u);
      ctx.fillRect(x + 7 * u, y + 4 * u, 7 * u, 9 * u);
      ctx.fillStyle = '#A2A07B';
      ctx.fillRect(x + 4 * u, y + 7 * u, 3 * u, 2 * u);
      ctx.fillRect(x + 9 * u, y + 5 * u, 3 * u, 3 * u);
    } else {
      ctx.fillStyle = '#49653A';
      ctx.fillRect(x + 3 * u, y + 8 * u, 11 * u, 5 * u);
      ctx.fillRect(x + 6 * u, y + 3 * u, 5 * u, 9 * u);
      ctx.fillStyle = '#82A854';
      ctx.fillRect(x + 4 * u, y + 6 * u, 4 * u, 4 * u);
      ctx.fillRect(x + 9 * u, y + 7 * u, 3 * u, 3 * u);
    }
  } else if (currentTheme === 'ink') {
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (currentTheme === 'starry') {
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
