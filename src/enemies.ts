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
  // 像素精靈引用色
  colorPrimary: string;
  colorSecondary: string;
}

/** 所有怪物類型定義 */
export const ENEMY_DEFS: Record<EnemyTypeId, EnemyDef> = {
  snake: {
    id: 'snake', name: '小蛇', element: 'wood',
    baseHp: 80, speed: 1.0, goldAward: 2, isFlying: false,
    colorPrimary: '#22c55e', colorSecondary: '#bbf7d0'
  },
  fly: {
    id: 'fly', name: '小蒼蠅', element: 'metal',
    baseHp: 50, speed: 1.4, goldAward: 3, isFlying: true,
    colorPrimary: '#6b7280', colorSecondary: '#d1d5db'
  },
  salamander: {
    id: 'salamander', name: '火蜥蜴', element: 'fire',
    baseHp: 100, speed: 0.9, goldAward: 3, isFlying: false,
    colorPrimary: '#ef4444', colorSecondary: '#fbbf24'
  },
  water_spirit: {
    id: 'water_spirit', name: '水靈', element: 'water',
    baseHp: 70, speed: 1.1, goldAward: 2, isFlying: false,
    colorPrimary: '#38bdf8', colorSecondary: '#bfdbfe'
  },
  golem: {
    id: 'golem', name: '石傀儡', element: 'earth',
    baseHp: 180, speed: 0.6, goldAward: 4, isFlying: false,
    colorPrimary: '#a8a29e', colorSecondary: '#78716c'
  },
  beetle: {
    id: 'beetle', name: '金甲蟲', element: 'metal',
    baseHp: 120, speed: 0.8, goldAward: 3, isFlying: false,
    colorPrimary: '#fbbf24', colorSecondary: '#d97706'
  },
  boss_dragon: {
    id: 'boss_dragon', name: '龍影', element: 'fire',
    baseHp: 500, speed: 0.5, goldAward: 15, isFlying: true,
    colorPrimary: '#dc2626', colorSecondary: '#7c2d12'
  }
};

/** 波次怪物配置 */
export interface WaveConfig {
  enemyType: EnemyTypeId;
  count: number;
  spawnIntervalMs: number; // 每隻怪生成間隔 (毫秒)
  hpMultiplier: number;    // 對 baseHp 的倍率
}

/** 取得指定波次的怪物配置（多種怪混合出場） */
export function getWaveConfig(waveNum: number): WaveConfig[] {
  const configs: WaveConfig[] = [];
  // Segmented exponential: linear for waves 1-5, then 1.8 * 1.16^(wave-5) for waves 6-20
  let hpMult: number;
  if (waveNum <= 5) {
    hpMult = 1.0 + (waveNum - 1) * 0.20; // Wave 1-5: 1.0x -> 1.8x (gentle intro)
  } else {
    hpMult = 1.8 * Math.pow(1.16, waveNum - 5); // Wave 6-20: exponential growth -> ~23x at wave 20
  }

  // 每波必有基礎地面怪
  const groundTypes: EnemyTypeId[] = ['snake', 'salamander', 'water_spirit', 'golem', 'beetle'];
  // 以波次決定出場類型多樣性
  const numTypes = Math.min(1 + Math.floor(waveNum / 3), groundTypes.length);

  for (let i = 0; i < numTypes; i++) {
    const typeIdx = (waveNum + i) % groundTypes.length;
    configs.push({
      enemyType: groundTypes[typeIdx],
      count: 6 + Math.floor(waveNum * 0.8),
      spawnIntervalMs: Math.max(300, 600 - waveNum * 15),
      hpMultiplier: hpMult
    });
  }

  // 每 3 波出一批飛行怪
  if (waveNum % 3 === 0) {
    configs.push({
      enemyType: 'fly',
      count: 3 + Math.floor(waveNum / 2),
      spawnIntervalMs: 800,
      hpMultiplier: hpMult * 0.8
    });
  }

  // 每 5 波出 Boss
  if (waveNum % 5 === 0) {
    configs.push({
      enemyType: 'boss_dragon',
      count: 1,
      spawnIntervalMs: 0,
      hpMultiplier: hpMult * 1.5
    });
  }

  return configs;
}
