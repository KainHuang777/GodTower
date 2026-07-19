// src/battle/mapSetup.ts — 由地圖資料建立開場防禦塔

import type { MapConfig } from '../maps';
import type { Tower } from '../types';
import { getTowerDef } from '../towers';
import { validatePlacement } from './pathfinding';

export interface InitialTowerSetup {
  towers: Tower[];
  nextTowerId: number;
}

export function createInitialTowers(
  map: MapConfig,
  grid: number[][],
  cols: number,
  rows: number,
  startingId = 1,
): InitialTowerSetup {
  const towers: Tower[] = [];
  let nextTowerId = startingId;

  for (const initial of map.initialTowers ?? []) {
    if (initial.x < 0 || initial.x >= cols || initial.y < 0 || initial.y >= rows) continue;
    if (grid[initial.x]?.[initial.y] !== 0) continue;
    if (towers.some(tower => tower.x === initial.x && tower.y === initial.y)) continue;

    const def = getTowerDef(initial.typeId);
    if (!def) continue;
    if (def.isWall && !validatePlacement(
      initial.x,
      initial.y,
      grid,
      cols,
      rows,
      map.spawnPoint,
      map.basePoint,
      map.waypoints,
      [],
    )) continue;

    grid[initial.x][initial.y] = def.isWall ? 1 : 0;
    towers.push({
      id: nextTowerId++,
      x: initial.x,
      y: initial.y,
      typeId: def.id,
      def: { ...def },
      cooldown: 0,
      recoilY: 0,
      damageDealt: 0,
      investmentCost: 0,
      locked: initial.locked,
    });
  }

  return { towers, nextTowerId };
}
