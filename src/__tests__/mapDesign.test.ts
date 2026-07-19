import { describe, expect, it } from 'vitest';
import { MAPS, type MapConfig } from '../maps';
import { astarFind, validatePlacement } from '../battle/pathfinding';
import { createInitialTowers } from '../battle/mapSetup';
import { getTowerDef } from '../towers';
import type { Point } from '../types';

function dimensions(map: MapConfig): { cols: number; rows: number } {
  return {
    cols: map.dimensions?.cols ?? 80,
    rows: map.dimensions?.rows ?? 40,
  };
}

function makeGrid(map: MapConfig): number[][] {
  const { cols, rows } = dimensions(map);
  const grid = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (const obstacle of map.obstacles) grid[obstacle.x][obstacle.y] = 2;
  return grid;
}

function buildRoute(map: MapConfig, grid: number[][]): Point[] {
  const { cols, rows } = dimensions(map);
  const route: Point[] = [];
  let start = map.spawnPoint;
  for (const target of [...map.waypoints, map.basePoint]) {
    const segment = astarFind(start, target, grid, cols, rows);
    expect(segment, `route ${start.x},${start.y} -> ${target.x},${target.y}`).not.toBeNull();
    route.push(...(route.length ? segment!.slice(1) : segment!));
    start = target;
  }
  return route;
}

function countRangeWindows(route: Point[], focus: Point, range: number): number {
  let windows = 0;
  let wasInside = false;
  for (const point of route) {
    const inside = Math.hypot(point.x - focus.x, point.y - focus.y) <= range;
    if (inside && !wasInside) windows++;
    wasInside = inside;
  }
  return windows;
}

describe('data-driven map designs', () => {
  it('keeps every protected map coordinate inside its declared dimensions', () => {
    for (const map of MAPS) {
      const { cols, rows } = dimensions(map);
      const points = [
        map.spawnPoint,
        map.basePoint,
        ...map.waypoints,
        ...map.obstacles,
        ...(map.initialTowers ?? []),
        ...(map.tutorialHints?.wallTiles ?? []),
        ...(map.presentation?.terrainProps ?? []),
      ];
      for (const point of points) {
        expect(point.x, `${map.id} x`).toBeGreaterThanOrEqual(0);
        expect(point.x, `${map.id} x`).toBeLessThan(cols);
        expect(point.y, `${map.id} y`).toBeGreaterThanOrEqual(0);
        expect(point.y, `${map.id} y`).toBeLessThan(rows);
      }
    }
  });

  it('creates exactly one free locked tutorial tower without blocking the route', () => {
    const map = MAPS.find(candidate => candidate.id === 'tutorial')!;
    const { cols, rows } = dimensions(map);
    const grid = makeGrid(map);
    const setup = createInitialTowers(map, grid, cols, rows);

    expect(setup.towers).toHaveLength(1);
    expect(setup.towers[0]).toMatchObject({
      typeId: 'fire',
      x: 10,
      y: 5,
      investmentCost: 0,
      locked: true,
    });
    expect(grid[10][5]).toBe(1);

    const route = buildRoute(map, grid);
    const fireRange = getTowerDef('fire')!.range;
    expect(countRangeWindows(route, { x: 10, y: 5 }, fireRange)).toBe(map.presentation!.expectedAttackWindows);
  });

  it('keeps six independent fire-tower range windows at the easy-map center', () => {
    const map = MAPS.find(candidate => candidate.id === 'easy')!;
    const { cols, rows } = dimensions(map);
    const grid = makeGrid(map);
    const focus = map.presentation!.focusPoint!;
    expect(validatePlacement(
      focus.x,
      focus.y,
      grid,
      cols,
      rows,
      map.spawnPoint,
      map.basePoint,
      map.waypoints,
      [],
    )).toBe(true);
    grid[focus.x][focus.y] = 1;

    const route = buildRoute(map, grid);
    const fireRange = getTowerDef('fire')!.range;
    expect(countRangeWindows(route, focus, fireRange)).toBe(6);
  });
});
