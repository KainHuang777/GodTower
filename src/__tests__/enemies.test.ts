import { describe, it, expect } from 'vitest';
import { ENEMY_DEFS, getWaveConfig } from '../enemies';
import type { EnemyTypeId, WaveConfig } from '../enemies';

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
});

// ============================================================
// 2. P0 — HP Curve Validation (Segmented Exponential)
// ============================================================
describe('HP Curve Validation', () => {
  /** Extract hpMultiplier from the first ground enemy in the config */
  function hpMultForWave(waveNum: number): number {
    const configs = getWaveConfig(waveNum);
    return configs[0].hpMultiplier;
  }

  // Exact values from the formula:
  //   Waves 1-5: 1.0 + (waveNum - 1) * 0.20
  //   Waves 6-20: 1.8 * Math.pow(1.16, waveNum - 5)
  const exactValues: Record<number, number> = {
    1: 1.0,
    2: 1.2,
    3: 1.4,
    4: 1.6,
    5: 1.8,
    6: 2.088,                  // 1.8 * 1.16^1
    10: 3.78061498368,         // 1.8 * 1.16^5
    15: 7.940583141569849,     // 1.8 * 1.16^10
    20: 16.677937557875433,    // 1.8 * 1.16^15
  };

  it('Wave 1: hpMultiplier = 1.0 (exact)', () => {
    expect(hpMultForWave(1)).toBe(1.0);
  });

  it('Wave 2: hpMultiplier = 1.2 (exact)', () => {
    expect(hpMultForWave(2)).toBe(1.2);
  });

  it('Wave 3: hpMultiplier = 1.4 (exact)', () => {
    expect(hpMultForWave(3)).toBe(1.4);
  });

  it('Wave 4: hpMultiplier = 1.6 (exact)', () => {
    expect(hpMultForWave(4)).toBe(1.6);
  });

  it('Wave 5: hpMultiplier = 1.8 (exact)', () => {
    expect(hpMultForWave(5)).toBe(1.8);
  });

  it('Wave 6: hpMultiplier ≈ 2.088 (±0.001)', () => {
    expect(hpMultForWave(6)).toBeCloseTo(2.088, 3);
  });

  it('Wave 10: hpMultiplier ≈ 3.781 (±0.01)', () => {
    expect(hpMultForWave(10)).toBeCloseTo(exactValues[10], 2);
  });

  it('Wave 15: hpMultiplier ≈ 7.941 (±0.1)', () => {
    expect(hpMultForWave(15)).toBeCloseTo(exactValues[15], 1);
  });

  it('Wave 20: hpMultiplier ≈ 16.678 (±0.5)', () => {
    expect(hpMultForWave(20)).toBeCloseTo(exactValues[20], 0);
  });

  it('HP curve is monotonically increasing', () => {
    let prev = hpMultForWave(1);
    for (let w = 2; w <= 20; w++) {
      const curr = hpMultForWave(w);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it('Linear segment: waves 1-5 increment is exactly 0.2', () => {
    for (let w = 1; w <= 4; w++) {
      expect(hpMultForWave(w + 1) - hpMultForWave(w)).toBeCloseTo(0.2, 5);
    }
  });

  it('Exponential segment: each wave 6+ ratio to previous ≈ 1.16 (±0.001)', () => {
    for (let w = 6; w <= 20; w++) {
      const ratio = hpMultForWave(w) / hpMultForWave(w - 1);
      expect(ratio).toBeCloseTo(1.16, 3);
    }
  });
});

// ============================================================
// 3. Wave Composition — Boss & Fly Timing
// ============================================================
describe('Wave Composition - Boss & Fly Timing', () => {
  function hasEnemyType(configs: WaveConfig[], type: EnemyTypeId): boolean {
    return configs.some(c => c.enemyType === type);
  }

  function findEntry(configs: WaveConfig[], type: EnemyTypeId): WaveConfig | undefined {
    return configs.find(c => c.enemyType === type);
  }

  it('Waves 5, 10, 15, 20 have boss_dragon entry', () => {
    for (const w of [5, 10, 15, 20]) {
      const configs = getWaveConfig(w);
      expect(hasEnemyType(configs, 'boss_dragon')).toBe(true);
    }
  });

  it('Waves not divisible by 5 do NOT have boss_dragon', () => {
    for (let w = 1; w <= 20; w++) {
      if (w % 5 !== 0) {
        const configs = getWaveConfig(w);
        expect(hasEnemyType(configs, 'boss_dragon')).toBe(false);
      }
    }
  });

  it('Waves 3, 6, 9, 12, 15, 18 have fly entry (every 3rd wave)', () => {
    for (const w of [3, 6, 9, 12, 15, 18]) {
      const configs = getWaveConfig(w);
      expect(hasEnemyType(configs, 'fly')).toBe(true);
    }
  });

  it('Waves not divisible by 3 have no fly entry', () => {
    for (let w = 1; w <= 20; w++) {
      if (w % 3 !== 0) {
        const configs = getWaveConfig(w);
        expect(hasEnemyType(configs, 'fly')).toBe(false);
      }
    }
  });

  it('Boss count is always 1', () => {
    for (const w of [5, 10, 15, 20]) {
      const boss = findEntry(getWaveConfig(w), 'boss_dragon');
      expect(boss).toBeDefined();
      expect(boss!.count).toBe(1);
    }
  });

  it('Boss hpMultiplier = base hpMult × 1.5', () => {
    for (const w of [5, 10, 15, 20]) {
      const configs = getWaveConfig(w);
      const groundHpMult = configs[0].hpMultiplier; // first ground enemy gives base hpMult
      const boss = findEntry(configs, 'boss_dragon')!;
      expect(boss.hpMultiplier).toBeCloseTo(groundHpMult * 1.5, 5);
    }
  });

  it('Fly hpMultiplier = base hpMult × 0.8', () => {
    for (const w of [3, 6, 9, 12, 15, 18]) {
      const configs = getWaveConfig(w);
      const groundHpMult = configs[0].hpMultiplier;
      const fly = findEntry(configs, 'fly')!;
      expect(fly.hpMultiplier).toBeCloseTo(groundHpMult * 0.8, 5);
    }
  });
});

// ============================================================
// 4. Enemy Count & Spawn Progression
// ============================================================
describe('Enemy Count & Spawn Progression', () => {
  it('Wave 1: count = 6, 1 ground type', () => {
    const configs = getWaveConfig(1);
    // Only ground types (no fly, no boss), and numTypes = min(1+floor(1/3), 5) = 1
    expect(configs.length).toBe(1);
    expect(configs[0].count).toBe(6); // 6 + floor(1 * 0.8) = 6
  });

  it('Wave 10: count = 14, numTypes = 4', () => {
    const configs = getWaveConfig(10);
    const groundConfigs = configs.filter(c =>
      ['snake', 'salamander', 'water_spirit', 'golem', 'beetle'].includes(c.enemyType)
    );
    // numTypes = min(1+floor(10/3), 5) = min(1+3, 5) = 4
    expect(groundConfigs.length).toBe(4);
    for (const gc of groundConfigs) {
      expect(gc.count).toBe(14); // 6 + floor(10 * 0.8) = 6 + 8 = 14
    }
  });

  it('Wave 12+: 5 ground types (capped)', () => {
    for (const w of [12, 15, 18, 20]) {
      const configs = getWaveConfig(w);
      const groundConfigs = configs.filter(c =>
        ['snake', 'salamander', 'water_spirit', 'golem', 'beetle'].includes(c.enemyType)
      );
      expect(groundConfigs.length).toBe(5);
    }
  });

  it('Ground enemy count formula: 6 + floor(waveNum × 0.8)', () => {
    for (let w = 1; w <= 20; w++) {
      const configs = getWaveConfig(w);
      const groundConfigs = configs.filter(c =>
        ['snake', 'salamander', 'water_spirit', 'golem', 'beetle'].includes(c.enemyType)
      );
      const expectedCount = 6 + Math.floor(w * 0.8);
      for (const gc of groundConfigs) {
        expect(gc.count).toBe(expectedCount);
      }
    }
  });

  it('Spawn interval decreases with wave number', () => {
    let prev = getWaveConfig(1)[0].spawnIntervalMs;
    for (let w = 2; w <= 20; w++) {
      const curr = getWaveConfig(w)[0].spawnIntervalMs;
      // Non-increasing: should never go up
      expect(curr).toBeLessThanOrEqual(prev);
      prev = curr;
    }
  });

  it('Spawn interval formula: max(300, 600 - waveNum × 15)', () => {
    for (let w = 1; w <= 20; w++) {
      const configs = getWaveConfig(w);
      const expected = Math.max(300, 600 - w * 15);
      expect(configs[0].spawnIntervalMs).toBe(expected);
    }
  });

  it('Spawn interval floors at 300ms at wave 20', () => {
    // Wave 20: max(300, 600 - 20*15) = max(300, 300) = 300
    expect(getWaveConfig(20)[0].spawnIntervalMs).toBe(300);
    // Verify it stays at 300 for waves beyond 20
    for (let w = 21; w <= 25; w++) {
      expect(getWaveConfig(w)[0].spawnIntervalMs).toBe(300);
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
