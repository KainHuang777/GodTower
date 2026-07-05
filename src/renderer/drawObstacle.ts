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
