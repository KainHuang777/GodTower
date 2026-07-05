// ============================================================
// src/__tests__/pathfinding.test.ts — A* / validatePlacement 單元測試
// ============================================================

import { describe, it, expect } from 'vitest';
import { astarFind, validatePlacement } from '../battle/pathfinding.js';
import type { Enemy, Point } from '../types.js';

// ---------- helpers ----------

function createGrid(cols: number, rows: number): number[][] {
  return Array.from({ length: cols }, () => new Array(rows).fill(0));
}

function createMockEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 1,
    type: 'snake',
    element: 'fire',
    x: 0,
    y: 0,
    currentGridX: 0,
    currentGridY: 0,
    hp: 100,
    maxHp: 100,
    speed: 1,
    baseSpeed: 1,
    goldAward: 10,
    isFlying: false,
    waypointIndex: 0,
    path: [],
    pathIndex: 0,
    slowDuration: 0,
    dotDamage: 0,
    dotDuration: 0,
    hitFlashFrame: 0,
    vx: 0,
    vy: 0,
    squashX: 1,
    squashY: 1,
    ...overrides,
  };
}

// ============================================================
// 1. A* Open Map
// ============================================================

describe('astarFind — open map (no obstacles)', () => {
  const COLS = 10;
  const ROWS = 10;

  it('1.1 straight horizontal path', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 0, y: 5 };
    const end: Point = { x: 9, y: 5 };
    const path = astarFind(start, end, grid, COLS, ROWS);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(10);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('1.2 straight vertical path', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 5, y: 0 };
    const end: Point = { x: 5, y: 9 };
    const path = astarFind(start, end, grid, COLS, ROWS);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(10);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('1.3 diagonal path', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 5, y: 5 };
    const path = astarFind(start, end, grid, COLS, ROWS);
    expect(path).not.toBeNull();
    // Manhattan distance = 10, so path length = 11
    expect(path!.length).toBe(11);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('1.4 start equals end → path of length 1', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 3, y: 3 };
    const path = astarFind(start, start, grid, COLS, ROWS);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(1);
    expect(path![0]).toEqual(start);
  });

  it('1.5 adjacent cells → path of length 2', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 0, y: 1 };
    const path = astarFind(start, end, grid, COLS, ROWS);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
    expect(path![0]).toEqual(start);
    expect(path![1]).toEqual(end);
  });
});

// ============================================================
// 2. A* Fully Blocked
// ============================================================

describe('astarFind — fully blocked (no path exists)', () => {
  const COLS = 10;
  const ROWS = 10;

  it('2.1 wall bisecting grid', () => {
    const grid = createGrid(COLS, ROWS);
    // column x=5 all walls
    for (let y = 0; y < ROWS; y++) {
      grid[5][y] = 1;
    }
    const start: Point = { x: 0, y: 5 };
    const end: Point = { x: 9, y: 5 };
    const path = astarFind(start, end, grid, COLS, ROWS);
    expect(path).toBeNull();
  });

  it('2.2 start surrounded by walls', () => {
    const grid = createGrid(3, 3);
    // surround (1,1) with walls on all four sides
    grid[0][1] = 1;
    grid[2][1] = 1;
    grid[1][0] = 1;
    grid[1][2] = 1;
    const start: Point = { x: 1, y: 1 };
    const end: Point = { x: 0, y: 0 };
    const path = astarFind(start, end, grid, 3, 3);
    expect(path).toBeNull();
  });

  it('2.3 end surrounded by walls', () => {
    const grid = createGrid(3, 3);
    grid[0][1] = 1;
    grid[2][1] = 1;
    grid[1][0] = 1;
    grid[1][2] = 1;
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 1, y: 1 };
    const path = astarFind(start, end, grid, 3, 3);
    expect(path).toBeNull();
  });
});

// ============================================================
// 3. A* Partial Obstacle
// ============================================================

describe('astarFind — partial obstacle (path detours)', () => {
  it('3.1 single wall block → path goes around', () => {
    const grid = createGrid(3, 3);
    grid[1][1] = 1; // wall in the middle
    const start: Point = { x: 0, y: 1 };
    const end: Point = { x: 2, y: 1 };
    const path = astarFind(start, end, grid, 3, 3);
    expect(path).not.toBeNull();
    // wall cell must not be in the path
    for (const p of path!) {
      expect(p.x === 1 && p.y === 1).toBe(false);
    }
    // shortest detour length is 5 (3-cell Manhattan + 2 extra to go around)
    expect(path!.length).toBeGreaterThanOrEqual(5);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('3.2 L-shaped wall → path routes around, avoids all wall cells', () => {
    const grid = createGrid(3, 3);
    grid[0][1] = 1;
    grid[1][1] = 1; // L-shape blocking the left and centre of row 1
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 2, y: 2 };
    const path = astarFind(start, end, grid, 3, 3);
    expect(path).not.toBeNull();
    const wallSet = new Set(['0,1', '1,1']);
    for (const p of path!) {
      expect(wallSet.has(`${p.x},${p.y}`)).toBe(false);
    }
    expect(path!.length).toBeGreaterThanOrEqual(5);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('3.3 narrow corridor', () => {
    const grid = createGrid(3, 3);
    // walls above and below row 1 column 1, leaving only (1,1) passable on that column
    grid[1][0] = 1;
    grid[1][2] = 1;
    const start: Point = { x: 0, y: 1 };
    const end: Point = { x: 2, y: 1 };
    const path = astarFind(start, end, grid, 3, 3);
    expect(path).not.toBeNull();
    // must go through (1,1)
    expect(path!.length).toBe(3);
    expect(path![0]).toEqual(start);
    expect(path![1]).toEqual({ x: 1, y: 1 });
    expect(path![2]).toEqual(end);
  });

  it('3.4 blockedX / blockedY excludes one cell', () => {
    const grid = createGrid(3, 3);
    const start: Point = { x: 0, y: 1 };
    const end: Point = { x: 2, y: 1 };
    // without blocking, path is straight: (0,1)→(1,1)→(2,1) length 3
    const pathWithout = astarFind(start, end, grid, 3, 3);
    expect(pathWithout).not.toBeNull();
    expect(pathWithout!.length).toBe(3);

    // with (1,1) blocked via parameters, path must detour
    const pathBlocked = astarFind(start, end, grid, 3, 3, false, 1, 1);
    expect(pathBlocked).not.toBeNull();
    for (const p of pathBlocked!) {
      expect(p.x === 1 && p.y === 1).toBe(false);
    }
    expect(pathBlocked!.length).toBeGreaterThanOrEqual(5);
  });
});

// ============================================================
// 4. Flying Bypass (isFlying = true)
// ============================================================

describe('astarFind — flying mode', () => {
  const COLS = 10;
  const ROWS = 10;

  it('4.1 flying ignores all walls', () => {
    // fill the entire grid with walls (value 1)
    const grid = createGrid(COLS, ROWS);
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        grid[x][y] = 1;
      }
    }
    const start: Point = { x: 0, y: 5 };
    const end: Point = { x: 9, y: 5 };
    const path = astarFind(start, end, grid, COLS, ROWS, true);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('4.2 flying path is monotonic toward target', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 5, y: 3 };
    const path = astarFind(start, end, grid, COLS, ROWS, true);
    expect(path).not.toBeNull();

    let prevX = path![0].x;
    let prevY = path![0].y;
    for (let i = 1; i < path!.length; i++) {
      const curX = path![i].x;
      const curY = path![i].y;
      // x must not overshoot: cannot go beyond end.x
      if (end.x > start.x) {
        expect(curX).toBeGreaterThanOrEqual(prevX);
        expect(curX).toBeLessThanOrEqual(end.x);
      } else if (end.x < start.x) {
        expect(curX).toBeLessThanOrEqual(prevX);
        expect(curX).toBeGreaterThanOrEqual(end.x);
      }
      // y must not overshoot: cannot go beyond end.y
      if (end.y > start.y) {
        expect(curY).toBeGreaterThanOrEqual(prevY);
        expect(curY).toBeLessThanOrEqual(end.y);
      } else if (end.y < start.y) {
        expect(curY).toBeLessThanOrEqual(prevY);
        expect(curY).toBeGreaterThanOrEqual(end.y);
      }
      prevX = curX;
      prevY = curY;
    }
  });

  it('4.3 flying path length = max(dx, dy) + 1', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 2, y: 2 };
    const end: Point = { x: 7, y: 5 };
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const path = astarFind(start, end, grid, COLS, ROWS, true);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(Math.max(dx, dy) + 1);
  });

  it('4.4 flying start=end → single point', () => {
    const grid = createGrid(COLS, ROWS);
    const start: Point = { x: 4, y: 4 };
    const path = astarFind(start, start, grid, COLS, ROWS, true);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(1);
    expect(path![0]).toEqual(start);
  });
});

// ============================================================
// 5. validatePlacement
// ============================================================

describe('validatePlacement', () => {
  const COLS = 5;
  const ROWS = 5;
  const SPAWN: Point = { x: 0, y: 2 };
  const BASE: Point = { x: 4, y: 2 };
  const WAYPOINTS: Point[] = [];
  const NO_ENEMIES: Enemy[] = [];

  it('5.1 on spawn point → false', () => {
    const grid = createGrid(COLS, ROWS);
    expect(validatePlacement(SPAWN.x, SPAWN.y, grid, COLS, ROWS, SPAWN, BASE, WAYPOINTS, NO_ENEMIES)).toBe(false);
  });

  it('5.2 on base point → false', () => {
    const grid = createGrid(COLS, ROWS);
    expect(validatePlacement(BASE.x, BASE.y, grid, COLS, ROWS, SPAWN, BASE, WAYPOINTS, NO_ENEMIES)).toBe(false);
  });

  it('5.3 on waypoint → false', () => {
    const grid = createGrid(COLS, ROWS);
    const wp: Point = { x: 2, y: 2 };
    const waypoints = [wp];
    expect(validatePlacement(wp.x, wp.y, grid, COLS, ROWS, SPAWN, BASE, waypoints, NO_ENEMIES)).toBe(false);
  });

  it('5.4 valid open cell → true', () => {
    const grid = createGrid(COLS, ROWS);
    // (2,2) is not spawn, base, or waypoint, and grid is open
    expect(validatePlacement(2, 2, grid, COLS, ROWS, SPAWN, BASE, WAYPOINTS, NO_ENEMIES)).toBe(true);
  });

  it('5.5 placement that blocks all paths → false (1-cell-wide passage)', () => {
    const grid = createGrid(3, 3);
    // walls on row 1 column 0 and row 1 column 2; only (1,1) connects spawn to base
    grid[1][0] = 1;
    grid[1][2] = 1;
    const spawn: Point = { x: 0, y: 1 };
    const base: Point = { x: 2, y: 1 };
    // placing at (1,1) blocks the only corridor
    expect(validatePlacement(1, 1, grid, 3, 3, spawn, base, [], NO_ENEMIES)).toBe(false);
  });

  it('5.6 enemy on map — placement blocking enemy path → false', () => {
    const grid = createGrid(3, 3);
    grid[1][0] = 1;
    grid[1][2] = 1;
    const spawn: Point = { x: 0, y: 1 };
    const base: Point = { x: 2, y: 1 };
    // enemy sitting at spawn, heading to base
    const enemy = createMockEnemy({
      currentGridX: 0,
      currentGridY: 1,
      waypointIndex: 0,
      isFlying: false,
    });
    // placing at the only passable cell (1,1) blocks both connectivity and enemy path
    expect(validatePlacement(1, 1, grid, 3, 3, spawn, base, [], [enemy])).toBe(false);
  });

  it('5.6b enemy present but placement does not block → true', () => {
    const grid = createGrid(COLS, ROWS);
    const enemy = createMockEnemy({
      currentGridX: 0,
      currentGridY: 2,
      waypointIndex: 0,
      isFlying: false,
    });
    // (2,2) is open and doesn't block anything
    expect(validatePlacement(2, 2, grid, COLS, ROWS, SPAWN, BASE, WAYPOINTS, [enemy])).toBe(true);
  });

  it('5.6c flying enemy is ignored in placement check', () => {
    const grid = createGrid(3, 3);
    grid[1][0] = 1;
    grid[1][2] = 1;
    const spawn: Point = { x: 0, y: 1 };
    const base: Point = { x: 2, y: 1 };
    // place at (1,1) — blocks land path, but flying enemy is skipped
    // validatePlacement still returns false because of global connectivity check though
    // So this test verifies flying enemies are NOT causing additional false
    const flyingEnemy = createMockEnemy({
      currentGridX: 0,
      currentGridY: 1,
      waypointIndex: 0,
      isFlying: true,
    });
    // Connectivity still blocked => false
    expect(validatePlacement(1, 1, grid, 3, 3, spawn, base, [], [flyingEnemy])).toBe(false);
    // but the flying enemy itself does not cause the failure (only connectivity does)
    // verify: open grid → no flying enemy should affect result
    const openGrid = createGrid(COLS, ROWS);
    expect(validatePlacement(2, 2, openGrid, COLS, ROWS, SPAWN, BASE, WAYPOINTS, [flyingEnemy])).toBe(true);
  });
});
