// ============================================================
// src/enemies.ts — 怪物屬性定義與波次配置
// ============================================================

import type { Element } from './towers';

/** 怪物類型 ID */
export type EnemyTypeId = 'snake' | 'fly' | 'salamander' | 'water_spirit' | 'golem' | 'beetle' | 'boss_dragon';

/** 怪物定義資料 */
export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  element: Element;
  baseHp: number;
  speed: number;       // 像素/幀
  goldAward: number;
  isFlying: boolean;
  /** 相對一般 16px 單位的視覺縮放；可跨越多格繪製，不改尋路網格。 */
  visualScale?: number;
  /** 圓形受擊半徑，以格為單位；子彈碰撞需與視覺大小一致。 */
  collisionRadiusTiles?: number;
  // 像素精靈引用色
  colorPrimary: string;
  colorSecondary: string;
}

import enemiesConfig from './config/enemies.json';
import wavesConfig from './config/waves.json';

/** 所有怪物類型定義 */
export const ENEMY_DEFS: Record<EnemyTypeId, EnemyDef> = enemiesConfig.enemyDefs as Record<EnemyTypeId, EnemyDef>;

export function getEnemyVisualScale(type: EnemyTypeId): number {
  return ENEMY_DEFS[type]?.visualScale ?? 1;
}

export function getEnemyCollisionRadius(type: EnemyTypeId, tileSize: number): number {
  return (ENEMY_DEFS[type]?.collisionRadiusTiles ?? 0.35) * tileSize;
}

/** 波次怪物配置 */
export interface WaveConfig {
  enemyType: EnemyTypeId;
  count: number;
  spawnIntervalMs: number; // 每隻怪生成間隔 (毫秒)
  hpMultiplier: number;    // 對 baseHp 的倍率
  armor?: boolean;
  regen?: boolean;
  split?: boolean;
}

/** 取得指定波次的怪物配置（多種怪混合出場） */
export function getWaveConfig(waveNum: number): WaveConfig[] {
  const wavesList = (wavesConfig.waves || []) as any[];
  const waveData = wavesList.find(w => w.wave === waveNum);
  if (!waveData) return [];
  return waveData.enemies.map((e: any) => ({
    enemyType: e.enemyType as EnemyTypeId,
    count: e.count,
    spawnIntervalMs: e.spawnIntervalMs,
    hpMultiplier: e.hpMultiplier,
    armor: e.armor,
    regen: e.regen,
    split: e.split
  }));
}
