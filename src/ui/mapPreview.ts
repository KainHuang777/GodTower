// src/ui/mapPreview.ts — 關卡選擇卡的程式化路線縮圖

import type { MapConfig } from '../maps';
import type { Point } from '../types';

const VIEW_WIDTH = 260;
const VIEW_HEIGHT = 132;
const PADDING = 12;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function mapDimensions(map: MapConfig): { cols: number; rows: number } {
  return {
    cols: Math.max(1, finite(map.dimensions?.cols ?? 80, 80)),
    rows: Math.max(1, finite(map.dimensions?.rows ?? 40, 40)),
  };
}

function project(point: Point, map: MapConfig): Point {
  const { cols, rows } = mapDimensions(map);
  return {
    x: PADDING + finite(point.x) / Math.max(1, cols - 1) * (VIEW_WIDTH - PADDING * 2),
    y: PADDING + finite(point.y) / Math.max(1, rows - 1) * (VIEW_HEIGHT - PADDING * 2),
  };
}

function safeAccent(value?: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#9a6a28';
}

function pointList(points: Point[], map: MapConfig): string {
  return points.map(point => {
    const projected = project(point, map);
    return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
  }).join(' ');
}

export function renderMapPreview(map: MapConfig): string {
  const route = [map.spawnPoint, ...map.waypoints, map.basePoint];
  const accent = safeAccent(map.presentation?.previewAccent);
  const visibleIndices = map.visibleWaypointIndices ?? map.waypoints.map((_, index) => index);
  const spawn = project(map.spawnPoint, map);
  const base = project(map.basePoint, map);
  const focus = map.presentation?.focusPoint ? project(map.presentation.focusPoint, map) : null;
  const obstacleStep = Math.max(1, Math.ceil(map.obstacles.length / 28));
  const obstacles = map.obstacles.filter((_, index) => index % obstacleStep === 0);

  return `<svg class="level-route-preview" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="preview-grid-${map.id.replace(/[^a-z0-9_-]/gi, '')}" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(91,68,37,.12)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}" rx="5" fill="#d9c487"/>
    <rect width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}" rx="5" fill="url(#preview-grid-${map.id.replace(/[^a-z0-9_-]/gi, '')})"/>
    ${obstacles.map(point => {
      const p = project(point, map);
      return `<rect x="${(p.x - 2).toFixed(1)}" y="${(p.y - 2).toFixed(1)}" width="4" height="4" fill="#50613a"/>`;
    }).join('')}
    <polyline points="${pointList(route, map)}" fill="none" stroke="#5a3826" stroke-width="8" stroke-linecap="square" stroke-linejoin="miter" opacity=".92"/>
    <polyline points="${pointList(route, map)}" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="square" stroke-linejoin="miter"/>
    ${focus ? `<circle cx="${focus.x.toFixed(1)}" cy="${focus.y.toFixed(1)}" r="10" fill="none" stroke="#fff2aa" stroke-width="3"/><circle cx="${focus.x.toFixed(1)}" cy="${focus.y.toFixed(1)}" r="4" fill="#6c3b25"/>` : ''}
    ${visibleIndices.map((index, displayIndex) => {
      const waypoint = map.waypoints[index];
      if (!waypoint) return '';
      const p = project(waypoint, map);
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#fff1b8" stroke="#654126" stroke-width="2"/><text x="${p.x.toFixed(1)}" y="${(p.y + 2.4).toFixed(1)}" text-anchor="middle" font-size="6" font-weight="900" fill="#3a251b">${displayIndex + 1}</text>`;
    }).join('')}
    ${(map.initialTowers ?? []).map(tower => {
      const p = project(tower, map);
      return `<path d="M ${p.x.toFixed(1)} ${(p.y - 7).toFixed(1)} L ${(p.x + 7).toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${(p.y + 7).toFixed(1)} L ${(p.x - 7).toFixed(1)} ${p.y.toFixed(1)} Z" fill="#c84f2f" stroke="#fff1b8" stroke-width="2"/>`;
    }).join('')}
    <circle cx="${spawn.x.toFixed(1)}" cy="${spawn.y.toFixed(1)}" r="6" fill="#3e8d55" stroke="#fff1b8" stroke-width="2"/>
    <rect x="${(base.x - 6).toFixed(1)}" y="${(base.y - 6).toFixed(1)}" width="12" height="12" fill="#a9362b" stroke="#fff1b8" stroke-width="2"/>
  </svg>`;
}
