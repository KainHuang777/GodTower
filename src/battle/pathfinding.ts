// ============================================================
// src/battle/pathfinding.ts — A* 尋路、路徑緩存、驗證系統
// ============================================================

import type { Point, Enemy } from '../types';
import { updateTileCacheCanvas } from '../renderer/tileCache';

export class AStarNode {
  x: number; y: number; parent: AStarNode | null; g: number; h: number; f: number;
  constructor(x: number, y: number, parent: AStarNode | null, g: number, h: number) {
    this.x = x; this.y = y; this.parent = parent; this.g = g; this.h = h; this.f = g + h;
  }
}

export function astarFind(
  start: Point, end: Point,
  grid: number[][], COLS: number, ROWS: number,
  isFlying: boolean = false, blockedX = -1, blockedY = -1
): Point[] | null {
  if (isFlying) {
    const path: Point[] = [];
    let cx = start.x, cy = start.y;
    while (cx !== end.x || cy !== end.y) {
      path.push({ x: cx, y: cy });
      if (cx < end.x) cx++; else if (cx > end.x) cx--;
      if (cy < end.y) cy++; else if (cy > end.y) cy--;
    }
    path.push({ x: end.x, y: end.y });
    return path;
  }

  const openList: AStarNode[] = [];
  const closedSet = new Set<string>();
  const heuristic = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  openList.push(new AStarNode(start.x, start.y, null, 0, heuristic(start, end)));

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const cur = openList.shift()!;
    const key = `${cur.x},${cur.y}`;
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    if (cur.x === end.x && cur.y === end.y) {
      const path: Point[] = [];
      let n: AStarNode | null = cur;
      while (n) { path.push({ x: n.x, y: n.y }); n = n.parent; }
      return path.reverse();
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (grid[nx][ny] !== 0 || (nx === blockedX && ny === blockedY)) continue;
      const nKey = `${nx},${ny}`;
      if (closedSet.has(nKey)) continue;
      const g = cur.g + 1;
      const h = heuristic({ x: nx, y: ny }, end);
      const existing = openList.find(n => n.x === nx && n.y === ny);
      if (!existing) {
        openList.push(new AStarNode(nx, ny, cur, g, h));
      } else if (g < existing.g) {
        existing.g = g; existing.f = g + existing.h; existing.parent = cur;
      }
    }
  }
  return null;
}

export function recalculatePathTiles(
  grid: number[][], COLS: number, ROWS: number,
  SPAWN_POINT: Point, BASE_POINT: Point, WAYPOINTS: Point[],
  cachedPathTiles: Set<string>, cachedFullPath: Point[]
) {
  cachedPathTiles.clear();
  let fullPath: Point[] = [];
  let currentStart = SPAWN_POINT;
  const targets = [...WAYPOINTS, BASE_POINT];
  let blocked = false;

  for (const target of targets) {
    const segment = astarFind(currentStart, target, grid, COLS, ROWS, false);
    if (segment) {
      if (fullPath.length > 0) {
        fullPath = fullPath.concat(segment.slice(1));
      } else {
        fullPath = fullPath.concat(segment);
      }
      currentStart = target;
    } else {
      blocked = true;
      break;
    }
  }

  cachedFullPath.length = 0;
  if (!blocked) {
    for (const pt of fullPath) {
      cachedPathTiles.add(`${pt.x},${pt.y}`);
    }
    cachedFullPath.push(...fullPath);
  }
  updateTileCacheCanvas();
}

export function validatePlacement(
  x: number, y: number,
  grid: number[][], COLS: number, ROWS: number,
  SPAWN_POINT: Point, BASE_POINT: Point, WAYPOINTS: Point[],
  enemies: Enemy[]
): boolean {
  if (x === SPAWN_POINT.x && y === SPAWN_POINT.y) return false;
  if (x === BASE_POINT.x && y === BASE_POINT.y) return false;
  for (const wp of WAYPOINTS) { if (x === wp.x && y === wp.y) return false; }

  let tempStart = SPAWN_POINT;
  for (let i = 0; i <= WAYPOINTS.length; i++) {
    const target = i === WAYPOINTS.length ? BASE_POINT : WAYPOINTS[i];
    if (!astarFind(tempStart, target, grid, COLS, ROWS, false, x, y)) return false;
    tempStart = target;
  }
  for (const enemy of enemies) {
    if (enemy.isFlying) continue;
    const target = enemy.waypointIndex >= WAYPOINTS.length ? BASE_POINT : WAYPOINTS[enemy.waypointIndex];
    if (!astarFind({ x: enemy.currentGridX, y: enemy.currentGridY }, target, grid, COLS, ROWS, false, x, y)) return false;
  }
  return true;
}

export function updateAllEnemyPaths(
  enemies: Enemy[],
  grid: number[][], COLS: number, ROWS: number,
  SPAWN_POINT: Point, BASE_POINT: Point, WAYPOINTS: Point[],
  cachedPathTiles: Set<string>, cachedFullPath: Point[]
) {
  for (const enemy of enemies) {
    if (enemy.isFlying) continue;
    const target = enemy.waypointIndex >= WAYPOINTS.length ? BASE_POINT : WAYPOINTS[enemy.waypointIndex];
    const path = astarFind({ x: enemy.currentGridX, y: enemy.currentGridY }, target, grid, COLS, ROWS);
    if (path) { enemy.path = path; enemy.pathIndex = 0; }
  }
  recalculatePathTiles(grid, COLS, ROWS, SPAWN_POINT, BASE_POINT, WAYPOINTS, cachedPathTiles, cachedFullPath);
}
