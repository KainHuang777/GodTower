import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTalentData,
  saveTalentData,
  calcTalentPointsEarned,
  getBaseHP,
  getStartGold,
  getDamageMultiplier,
  getFireRateMultiplier,
  getWallCost,
  getTowerElementDamageMultiplier,
  canUnlockTalent,
  unlockTalent,
  isTowerUnlocked,
  isTalentTrackUnlocked,
  getTalentDifficultyMod,
  TALENT_TREE,
  TALENT_THEME_BY_ID,
} from '../talent';
import type { TalentSaveData } from '../talent';

let storage: Record<string, string>;
let setItemSpy: ReturnType<typeof vi.fn>;

function mockSaveData(
  overrides: Partial<TalentSaveData> = {}
): TalentSaveData {
  return {
    totalTalentPoints: 0,
    spentTalentPoints: 0,
    talentLevels: {},
    ...overrides,
  };
}

beforeEach(() => {
  storage = {};
  setItemSpy = vi.fn((key: string, value: string) => {
    storage[key] = value;
  });
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: setItemSpy,
  });
});

describe('P2-A talent display metadata', () => {
  it('keeps all 16 stable TalentIds with complete display metadata', () => {
    const expectedIds = [
      'fortress_1', 'fortress_2', 'gold_1', 'gold_2',
      'precise_1', 'precise_2', 'rapid_fire',
      'wood_awakening', 'water_awakening', 'fire_awakening',
      'earth_awakening', 'wall_discount', 'metal_awakening',
      'yin_law', 'yang_law', 'taiji_dao',
    ];

    expect(TALENT_TREE.map(node => node.id)).toEqual(expectedIds);
    for (const node of TALENT_TREE) {
      expect(node.displayName.length).toBeGreaterThan(0);
      expect(node.mechanicLabel.length).toBeGreaterThan(0);
      expect(node.classicAllusion.length).toBeGreaterThan(0);
      expect(node.sourceRef.length).toBeGreaterThan(0);
      expect(node.visualTheme).toBe(TALENT_THEME_BY_ID[node.id]);
    }
  });

  it('maps themes explicitly instead of deriving them from TalentId text', () => {
    expect(TALENT_THEME_BY_ID.fortress_1).toBe('du');
    expect(TALENT_THEME_BY_ID.gold_1).toBe('ren');
    expect(TALENT_THEME_BY_ID.wood_awakening).toBe('wood');
    expect(TALENT_THEME_BY_ID.wall_discount).toBe('earth');
    expect(TALENT_THEME_BY_ID.taiji_dao).toBe('taiji');
  });
});

describe('calcTalentPointsEarned', () => {
  // Track A base: max(1, floor(wave/4))
  it('0 waves -> 1 (minimum)', () => {
    expect(calcTalentPointsEarned(0)).toBe(1);
  });

  it('1-3 waves -> 1', () => {
    expect(calcTalentPointsEarned(1)).toBe(1);
    expect(calcTalentPointsEarned(2)).toBe(1);
    expect(calcTalentPointsEarned(3)).toBe(1);
  });

  it('8 waves -> 2', () => {
    expect(calcTalentPointsEarned(8)).toBe(2);
  });

  it('12 waves -> 3', () => {
    expect(calcTalentPointsEarned(12)).toBe(3);
  });

  it('20 waves -> 5', () => {
    expect(calcTalentPointsEarned(20)).toBe(5);
  });

  it('negative input -> 1 (minimum clamp)', () => {
    expect(calcTalentPointsEarned(-5)).toBe(1);
  });

  // Track B challenge run with PB bonus
  it('Track B: PB bonus on challenge run', () => {
    // PB=4, survived=6, base=1, PB bonus=floor((6-4)/2)=1, milestone5 first-time=+3, total=5
    expect(calcTalentPointsEarned(6, 4, [], true)).toBe(5);
  });

  it('Track B: milestone first-time bonus', () => {
    // survived=5, PB=4, base=1, PB bonus=0, milestone 5=+3, total=4
    const result = calcTalentPointsEarned(5, 4, [], true);
    expect(result).toBe(4);
    // same player second time: milestone already in list → no bonus
    const result2 = calcTalentPointsEarned(5, 5, [5], true);
    expect(result2).toBe(1); // base=1, PB=0, no milestone
  });
});

describe('isTalentTrackUnlocked', () => {
  it('keeps the base track open for a new player', () => {
    expect(isTalentTrackUnlocked(mockSaveData(), 'track-base')).toBe(true);
  });

  it('opens tracks at 2 / 6 / 12 lifetime talent points', () => {
    expect(isTalentTrackUnlocked(mockSaveData({ totalTalentPoints: 1 }), 'track-attack')).toBe(false);
    expect(isTalentTrackUnlocked(mockSaveData({ totalTalentPoints: 2 }), 'track-attack')).toBe(true);
    expect(isTalentTrackUnlocked(mockSaveData({ totalTalentPoints: 5 }), 'track-element')).toBe(false);
    expect(isTalentTrackUnlocked(mockSaveData({ totalTalentPoints: 6 }), 'track-element')).toBe(true);
    expect(isTalentTrackUnlocked(mockSaveData({ totalTalentPoints: 11 }), 'track-yinyang')).toBe(false);
    expect(isTalentTrackUnlocked(mockSaveData({ totalTalentPoints: 12 }), 'track-yinyang')).toBe(true);
  });

  it('preserves a previously invested legacy track below the new threshold', () => {
    const legacyData = mockSaveData({
      totalTalentPoints: 2,
      talentLevels: { water_awakening: 1 },
    });
    expect(isTalentTrackUnlocked(legacyData, 'track-element')).toBe(true);
  });
});

describe('getBaseHP', () => {
  it('no talents -> 20', () => {
    const data = mockSaveData();
    expect(getBaseHP(data)).toBe(20);
  });

  it('fortress_1 lv3 -> 35', () => {
    const data = mockSaveData({ talentLevels: { fortress_1: 3 } });
    expect(getBaseHP(data)).toBe(35);
  });

  it('fortress_2 lv2 -> 40', () => {
    const data = mockSaveData({ talentLevels: { fortress_2: 2 } });
    expect(getBaseHP(data)).toBe(40);
  });

  it('both maxed (lv5 each) -> 95', () => {
    const data = mockSaveData({ talentLevels: { fortress_1: 5, fortress_2: 5 } });
    expect(getBaseHP(data)).toBe(95);
  });
});

describe('getStartGold', () => {
  it('no talents -> 60', () => {
    const data = mockSaveData();
    expect(getStartGold(data)).toBe(60);
  });

  it('gold_1 lv5 -> 160', () => {
    const data = mockSaveData({ talentLevels: { gold_1: 5 } });
    expect(getStartGold(data)).toBe(160);
  });

  it('gold_2 lv5 only (60+150=210) -> capped at 200', () => {
    const data = mockSaveData({ talentLevels: { gold_2: 5 } });
    expect(getStartGold(data)).toBe(200); // soft cap at 200g
  });

  it('both maxed (310) -> capped at 200g (P2 soft cap)', () => {
    const data = mockSaveData({ talentLevels: { gold_1: 5, gold_2: 5 } });
    expect(getStartGold(data)).toBe(200); // soft cap protects early-game tension
  });
});

describe('getDamageMultiplier', () => {
  it('no talents -> 1.0', () => {
    const data = mockSaveData();
    expect(getDamageMultiplier(data)).toBe(1.0);
  });

  it('precise_1 lv5 -> 1.5', () => {
    const data = mockSaveData({ talentLevels: { precise_1: 5 } });
    expect(getDamageMultiplier(data)).toBeCloseTo(1.5);
  });

  it('precise_2 lv5 -> 1.75', () => {
    const data = mockSaveData({ talentLevels: { precise_2: 5 } });
    expect(getDamageMultiplier(data)).toBeCloseTo(1.75);
  });

  it('both maxed -> 2.25', () => {
    const data = mockSaveData({ talentLevels: { precise_1: 5, precise_2: 5 } });
    expect(getDamageMultiplier(data)).toBeCloseTo(2.25);
  });
});

describe('getFireRateMultiplier', () => {
  it('no talents -> 1.0', () => {
    const data = mockSaveData();
    expect(getFireRateMultiplier(data)).toBe(1.0);
  });

  it('rapid_fire lv1 -> 0.95', () => {
    const data = mockSaveData({ talentLevels: { rapid_fire: 1 } });
    expect(getFireRateMultiplier(data)).toBeCloseTo(0.95);
  });

  it('rapid_fire lv5 -> 0.75', () => {
    const data = mockSaveData({ talentLevels: { rapid_fire: 5 } });
    expect(getFireRateMultiplier(data)).toBeCloseTo(0.75);
  });

  it('rapid_fire lv10 -> 0.5 (clamped)', () => {
    const data = mockSaveData({ talentLevels: { rapid_fire: 10 } });
    expect(getFireRateMultiplier(data)).toBe(0.5);
  });

  it('rapid_fire lv100 -> 0.5 (min clamp)', () => {
    const data = mockSaveData({ talentLevels: { rapid_fire: 100 } });
    expect(getFireRateMultiplier(data)).toBe(0.5);
  });
});

describe('getWallCost', () => {
  it('no wall_discount -> 2', () => {
    const data = mockSaveData();
    expect(getWallCost(data)).toBe(2);
  });

  it('wall_discount lv1 -> 1', () => {
    const data = mockSaveData({ talentLevels: { wall_discount: 1 } });
    expect(getWallCost(data)).toBe(1);
  });
});

describe('getTowerElementDamageMultiplier', () => {
  it('fire with fire_awakening lv3 -> 1.3', () => {
    const data = mockSaveData({ talentLevels: { fire_awakening: 3 } });
    expect(getTowerElementDamageMultiplier(data, 'fire')).toBeCloseTo(1.3);
  });

  it('water with no talent -> 1.0', () => {
    const data = mockSaveData();
    expect(getTowerElementDamageMultiplier(data, 'water')).toBe(1.0);
  });

  it('yin with yin_law lv5 -> 1.5', () => {
    const data = mockSaveData({ talentLevels: { yin_law: 5 } });
    expect(getTowerElementDamageMultiplier(data, 'yin')).toBeCloseTo(1.5);
  });

  it('yang with yang_law lv1 -> 1.1', () => {
    const data = mockSaveData({ talentLevels: { yang_law: 1 } });
    expect(getTowerElementDamageMultiplier(data, 'yang')).toBeCloseTo(1.1);
  });

  it('metal with metal_awakening lv5 -> 1.5', () => {
    const data = mockSaveData({ talentLevels: { metal_awakening: 5 } });
    expect(getTowerElementDamageMultiplier(data, 'metal')).toBeCloseTo(1.5);
  });
});

describe('canUnlockTalent', () => {
  it('fortress_1 with 2 points, no prereqs -> true', () => {
    const data = mockSaveData({ totalTalentPoints: 2, talentLevels: {} });
    expect(canUnlockTalent(data, 'fortress_1')).toBe(true);
  });

  it('fortress_2 without fortress_1 -> false', () => {
    const data = mockSaveData({ totalTalentPoints: 5, talentLevels: {} });
    expect(canUnlockTalent(data, 'fortress_2')).toBe(false);
  });

  it('fortress_2 with fortress_1 lv1, 2 points -> true', () => {
    const data = mockSaveData({
      totalTalentPoints: 2,
      talentLevels: { fortress_1: 1 },
    });
    expect(canUnlockTalent(data, 'fortress_2')).toBe(true);
  });

  it('taiji_dao needs BOTH yin_law AND yang_law - missing both -> false', () => {
    const data = mockSaveData({ totalTalentPoints: 10, talentLevels: {} });
    expect(canUnlockTalent(data, 'taiji_dao')).toBe(false);
  });

  it('taiji_dao needs BOTH yin_law AND yang_law - has yin_law only -> false', () => {
    const data = mockSaveData({
      totalTalentPoints: 10,
      talentLevels: { yin_law: 1 },
    });
    expect(canUnlockTalent(data, 'taiji_dao')).toBe(false);
  });

  it('taiji_dao needs BOTH yin_law AND yang_law - has both -> true', () => {
    const data = mockSaveData({
      totalTalentPoints: 10,
      talentLevels: { yin_law: 1, yang_law: 1 },
    });
    expect(canUnlockTalent(data, 'taiji_dao')).toBe(true);
  });

  it('at maxLevel (lv5) -> false', () => {
    const data = mockSaveData({
      totalTalentPoints: 10,
      talentLevels: { fortress_1: 5 },
    });
    expect(canUnlockTalent(data, 'fortress_1')).toBe(false);
  });

  it('insufficient points -> false', () => {
    const data = mockSaveData({
      totalTalentPoints: 0,
      spentTalentPoints: 0,
      talentLevels: {},
    });
    expect(canUnlockTalent(data, 'fortress_1')).toBe(false);
  });

  it('unknown talentId -> false', () => {
    const data = mockSaveData({ totalTalentPoints: 100, talentLevels: {} });
    expect(canUnlockTalent(data, 'nonexistent' as any)).toBe(false);
  });
});

describe('unlockTalent', () => {
  it('successful unlock: increments level, spends points, returns true', () => {
    const data = mockSaveData({
      totalTalentPoints: 5,
      spentTalentPoints: 0,
      talentLevels: {},
    });
    const result = unlockTalent(data, 'fortress_1');
    expect(result).toBe(true);
    expect(data.talentLevels['fortress_1']).toBe(1);
    expect(data.spentTalentPoints).toBe(2);
  });

  it('failed unlock (canUnlock=false): state unchanged, returns false', () => {
    const data = mockSaveData({
      totalTalentPoints: 0,
      spentTalentPoints: 0,
      talentLevels: {},
    });
    const originalLevels = { ...data.talentLevels };
    const originalSpent = data.spentTalentPoints;
    const result = unlockTalent(data, 'fortress_1');
    expect(result).toBe(false);
    expect(data.talentLevels).toEqual(originalLevels);
    expect(data.spentTalentPoints).toBe(originalSpent);
  });

  it('calls saveTalentData after successful unlock (localStorage.setItem spy)', () => {
    const data = mockSaveData({
      totalTalentPoints: 5,
      talentLevels: {},
    });
    const callsBefore = setItemSpy.mock.calls.length;
    unlockTalent(data, 'fortress_1');
    expect(setItemSpy).toHaveBeenCalledTimes(callsBefore + 1);
  });

  it('does NOT call saveTalentData after failed unlock', () => {
    const data = mockSaveData({
      totalTalentPoints: 0,
      talentLevels: {},
    });
    const callsBefore = setItemSpy.mock.calls.length;
    unlockTalent(data, 'fortress_1');
    expect(setItemSpy).toHaveBeenCalledTimes(callsBefore);
  });
});

describe('isTowerUnlocked', () => {
  it('earth always unlocked', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'earth')).toBe(true);
  });

  it('fire always unlocked', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'fire')).toBe(true);
  });

  it('water locked without water_awakening', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'water')).toBe(false);
  });

  it('water unlocked with water_awakening lv1', () => {
    const data = mockSaveData({ talentLevels: { water_awakening: 1 } });
    expect(isTowerUnlocked(data, 'water')).toBe(true);
  });

  it('metal locked without metal_awakening', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'metal')).toBe(false);
  });

  it('yin locked without yin_law', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'yin')).toBe(false);
  });

  it('yang locked without yang_law', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'yang')).toBe(false);
  });

  it('wood locked without wood_awakening', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'wood')).toBe(false);
  });

  it('recipe tower (e.g. wood_fire) -> true (passthrough)', () => {
    const data = mockSaveData();
    expect(isTowerUnlocked(data, 'wood_fire')).toBe(true);
  });
});

describe('localStorage persistence', () => {
  it('loadTalentData with empty storage -> default', () => {
    const data = loadTalentData();
    expect(data.totalTalentPoints).toBe(0);
    expect(data.spentTalentPoints).toBe(0);
    expect(data.talentLevels).toEqual({});
  });

  it('saveTalentData then loadTalentData roundtrip -> deep equal', () => {
    const original = mockSaveData({
      totalTalentPoints: 10,
      spentTalentPoints: 5,
      talentLevels: { fortress_1: 3, precise_1: 2 },
    });
    saveTalentData(original);
    const reloaded = loadTalentData();
    expect(reloaded.totalTalentPoints).toBe(original.totalTalentPoints);
    expect(reloaded.spentTalentPoints).toBe(original.spentTalentPoints);
    expect(reloaded.talentLevels).toEqual(original.talentLevels);
    expect(storage['td_talent_data']).toBeDefined();
  });

  it('loads the previous checkpoint_maze_td_talent key as a fallback', () => {
    storage['checkpoint_maze_td_talent'] = JSON.stringify({
      totalTalentPoints: 7,
      spentTalentPoints: 2,
      talentLevels: { gold_1: 1 },
    });

    const data = loadTalentData();
    expect(data.totalTalentPoints).toBe(7);
    expect(data.spentTalentPoints).toBe(2);
    expect(data.talentLevels.gold_1).toBe(1);
  });

  it('loadTalentData with corrupted JSON -> default, no throw', () => {
    storage['checkpoint_maze_td_talent'] = 'not-valid-json{{{';
    expect(() => loadTalentData()).not.toThrow();
    const data = loadTalentData();
    expect(data.totalTalentPoints).toBe(0);
    expect(data.spentTalentPoints).toBe(0);
    expect(data.talentLevels).toEqual({});
  });

  it('old save migration: {unlockedTalents: ["fire_awakening"]} -> talentLevels.fire_awakening === 1', () => {
    storage['checkpoint_maze_td_talent'] = JSON.stringify({
      unlockedTalents: ['fire_awakening'],
    });
    const data = loadTalentData();
    expect(data.talentLevels['fire_awakening']).toBe(1);
  });
});

describe('talent damage amplification sanity', () => {
  it('max global damage multiplier <= 2.25 (both precise talents maxed)', () => {
    const data = mockSaveData({ talentLevels: { precise_1: 5, precise_2: 5 } });
    expect(getDamageMultiplier(data)).toBeLessThanOrEqual(5.0);
    expect(getDamageMultiplier(data)).toBeCloseTo(2.25);
  });

  it('max element-specific <= 1.5 (element talent lv5)', () => {
    const data = mockSaveData({ talentLevels: { fire_awakening: 5 } });
    expect(getTowerElementDamageMultiplier(data, 'fire')).toBeLessThanOrEqual(5.0);
    expect(getTowerElementDamageMultiplier(data, 'fire')).toBeCloseTo(1.5);
  });

  it('combined max <= 10.0 (global 2.25 * element 1.5 = 3.375)', () => {
    const data = mockSaveData({
      talentLevels: { precise_1: 5, precise_2: 5, fire_awakening: 5 },
    });
    const combined = getDamageMultiplier(data) * getTowerElementDamageMultiplier(data, 'fire');
    expect(combined).toBeLessThanOrEqual(10.0);
    expect(combined).toBeCloseTo(3.375);
  });

  it('max fire rate cooldown >= 0.5 at all levels', () => {
    for (let lv = 0; lv <= 20; lv++) {
      const data = mockSaveData({ talentLevels: { rapid_fire: lv } });
      expect(getFireRateMultiplier(data)).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('hasPlayedBefore save/load', () => {
  it('default hasPlayedBefore should be false', () => {
    const data = loadTalentData();
    expect(data.hasPlayedBefore).toBe(false);
  });

  it('can save and load hasPlayedBefore flag correctly', () => {
    const data = mockSaveData({ hasPlayedBefore: true });
    saveTalentData(data);
    const loaded = loadTalentData();
    expect(loaded.hasPlayedBefore).toBe(true);
  });
});
// ============================================================
// B3 P2 耦合調整測試：getStartGold 軟上限
// ============================================================
describe('getStartGold soft cap (P2 coupling)', () => {
  it('base gold is 60 with no talents', () => {
    const data = mockSaveData();
    expect(getStartGold(data)).toBe(60);
  });

  it('gold_1 lv5 adds 100g, total 160g (no cap)', () => {
    const data = mockSaveData({ talentLevels: { gold_1: 5 } });
    expect(getStartGold(data)).toBe(160);
  });

  it('gold_1 lv5 + gold_2 lv1 = 60+100+30=190g (no cap)', () => {
    const data = mockSaveData({ talentLevels: { gold_1: 5, gold_2: 1 } });
    expect(getStartGold(data)).toBe(190);
  });

  it('gold_1 lv5 + gold_2 lv3 = 60+100+90=250g → capped at 200g', () => {
    const data = mockSaveData({ talentLevels: { gold_1: 5, gold_2: 3 } });
    expect(getStartGold(data)).toBe(200);
  });

  it('gold_1 lv5 + gold_2 lv5 = 310g → capped at 200g', () => {
    const data = mockSaveData({ talentLevels: { gold_1: 5, gold_2: 5 } });
    expect(getStartGold(data)).toBe(200);
  });
});

// ============================================================
// B3 P1 耦合調整測試：getTalentDifficultyMod 天賦難度因子
// ============================================================
describe('getTalentDifficultyMod (P1 coupling)', () => {
  it('0 spent points -> 0.0 mod (no boost)', () => {
    const data = mockSaveData({ spentTalentPoints: 0 });
    expect(getTalentDifficultyMod(data)).toBeCloseTo(0.0);
  });

  it('85 spent points -> 0.50 mod (max boost)', () => {
    const data = mockSaveData({ spentTalentPoints: 85 });
    expect(getTalentDifficultyMod(data)).toBeCloseTo(0.5);
  });

  it('excess spent points capped at SPENT_MAX=85', () => {
    const data = mockSaveData({ spentTalentPoints: 200 });
    expect(getTalentDifficultyMod(data)).toBeCloseTo(0.5);
  });

  it('42 spent points -> ~0.247 mod (midrange)', () => {
    const data = mockSaveData({ spentTalentPoints: 42 });
    const mod = getTalentDifficultyMod(data);
    expect(mod).toBeGreaterThan(0.2);
    expect(mod).toBeLessThan(0.3);
  });

  it('mod is always non-negative', () => {
    for (const pts of [0, 10, 30, 50, 85, 100]) {
      const data = mockSaveData({ spentTalentPoints: pts });
      expect(getTalentDifficultyMod(data)).toBeGreaterThanOrEqual(0);
    }
  });

  it('enemy effective HP increases with talent investment (sanity check)', () => {
    const noTalent = mockSaveData({ spentTalentPoints: 0 });
    const fullTalent = mockSaveData({ spentTalentPoints: 85 });
    const baseHp = 100;
    const hpMult = 4.0; // Wave 10 Boss

    const hpNoTalent = Math.floor(baseHp * hpMult * (1 + getTalentDifficultyMod(noTalent)));
    const hpFullTalent = Math.floor(baseHp * hpMult * (1 + getTalentDifficultyMod(fullTalent)));

    expect(hpFullTalent).toBeGreaterThan(hpNoTalent);
    // 最多 +50%
    expect(hpFullTalent).toBeLessThanOrEqual(hpNoTalent * 1.51);
  });
});
