import { describe, it, expect } from 'vitest';
import { ENEMY_DEFS, getEnemyCollisionRadius, getEnemyVisualScale, getWaveConfig } from '../enemies';
import type { EnemyTypeId } from '../enemies';
import { getEnemySpriteDimensions, getEnemySpriteFrameCount } from '../sprites';

// ============================================================
// 1. Smoke — Enemy Registry
// ============================================================
describe('Enemy Registry', () => {
  const allTypes: EnemyTypeId[] = [
    'snake', 'fly', 'salamander', 'water_spirit', 'golem', 'beetle', 'boss_dragon'
  ];

  it('1.1 all 7 enemy types exist in ENEMY_DEFS', () => {
    for (const type of allTypes) {
      expect(ENEMY_DEFS[type]).toBeDefined();
      expect(ENEMY_DEFS[type].id).toBe(type);
    }
  });

  it('1.2 every enemy has valid baseHp > 0', () => {
    for (const type of allTypes) {
      expect(ENEMY_DEFS[type].baseHp).toBeGreaterThan(0);
    }
  });

  it('1.3 every enemy has speed > 0', () => {
    for (const type of allTypes) {
      expect(ENEMY_DEFS[type].speed).toBeGreaterThan(0);
    }
  });

  it('1.4 every enemy has goldAward > 0', () => {
    for (const type of allTypes) {
      expect(ENEMY_DEFS[type].goldAward).toBeGreaterThan(0);
    }
  });

  it('1.5 only fly and boss_dragon are flying (isFlying === true)', () => {
    const flyingTypes = allTypes.filter(t => ENEMY_DEFS[t].isFlying);
    expect(flyingTypes).toEqual(['fly', 'boss_dragon']);

    const nonFlying = allTypes.filter(t => !ENEMY_DEFS[t].isFlying);
    expect(nonFlying).toEqual(['snake', 'salamander', 'water_spirit', 'golem', 'beetle']);
  });

  it('1.6 boss_dragon has highest baseHp (500)', () => {
    expect(ENEMY_DEFS['boss_dragon'].baseHp).toBe(500);
    for (const type of allTypes) {
      if (type !== 'boss_dragon') {
        expect(ENEMY_DEFS[type].baseHp).toBeLessThan(500);
      }
    }
  });

  it('1.7 boss visual size and collision radius scale together', () => {
    const tileSize = 16;
    expect(getEnemyVisualScale('boss_dragon')).toBeGreaterThan(1);
    expect(getEnemyCollisionRadius('boss_dragon', tileSize)).toBeCloseTo(12);
    expect(getEnemyCollisionRadius('boss_dragon', tileSize)).toBeGreaterThan(
      getEnemyCollisionRadius('snake', tileSize)
    );
  });

  it('1.8 P1 new enemies use two-frame 24×24 source sprites', () => {
    const newEnemyTypes: EnemyTypeId[] = [
      'shadow_cat', 'basalt_tortoise', 'thunder_roc', 'wandering_wisp',
    ];

    for (const type of newEnemyTypes) {
      expect(getEnemySpriteDimensions(type)).toEqual({ width: 24, height: 24 });
      expect(getEnemySpriteFrameCount(type)).toBe(2);
    }
  });
});

// ============================================================
// 2. Data-Driven Wave Configuration Sanity
// ============================================================
describe('Data-Driven Wave Configuration Sanity', () => {
  it('waves 1 to 20 all return non-empty configurations', () => {
    for (let w = 1; w <= 20; w++) {
      const config = getWaveConfig(w);
      expect(config).toBeDefined();
      expect(config.length).toBeGreaterThan(0);
      
      for (const entry of config) {
        expect(entry.enemyType).toBeDefined();
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.hpMultiplier).toBeGreaterThan(0);
        expect(entry.spawnIntervalMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('Boss waves (5, 10, 15, 20) contain exactly 1 boss_dragon with specific mechanisms', () => {
    const bossWaves = [5, 10, 15, 20];
    for (const w of bossWaves) {
      const config = getWaveConfig(w);
      const boss = config.find(c => c.enemyType === 'boss_dragon');
      expect(boss).toBeDefined();
      expect(boss!.count).toBe(1);
      
      // 驗證特定波次的 Boss 機制
      if (w === 5) {
        // Wave 5 基礎 Boss
        expect(boss!.hpMultiplier).toBeDefined();
      } else if (w === 10) {
        // Wave 10 裝甲
        expect(boss!.armor).toBe(true);
      } else if (w === 15) {
        // Wave 15 再生
        expect(boss!.regen).toBe(true);
      } else if (w === 20) {
        // Wave 20 分裂
        expect(boss!.split).toBe(true);
      }
    }
  });

  it('Wave 1-3 design constraints (beginner friendly)', () => {
    // 前 3 波應只包含普通基礎怪，便於新玩家上手
    for (let w = 1; w <= 3; w++) {
      const config = getWaveConfig(w);
      for (const entry of config) {
        expect(entry.enemyType).not.toBe('boss_dragon');
        expect(entry.hpMultiplier).toBeLessThanOrEqual(2.0);
      }
    }
  });
});

// ============================================================
// 5. Snapshot Tests
// ============================================================
describe('Snapshot Tests', () => {
  it('Wave 1 snapshot', () => {
    expect(getWaveConfig(1)).toMatchSnapshot();
  });

  it('Wave 5 snapshot', () => {
    expect(getWaveConfig(5)).toMatchSnapshot();
  });

  it('Wave 10 snapshot', () => {
    expect(getWaveConfig(10)).toMatchSnapshot();
  });

  it('Wave 15 snapshot', () => {
    expect(getWaveConfig(15)).toMatchSnapshot();
  });

  it('Wave 20 snapshot', () => {
    expect(getWaveConfig(20)).toMatchSnapshot();
  });
});
