import { describe, it, expect } from 'vitest';
import type { TalentSaveData } from '../talent';
import {
  markEnemySeen,
  markTowerCrafted,
  isEnemySeen,
  isTowerCrafted,
  addKill,
  addMerge,
  updateEndOfRunStats,
  evaluateAchievements,
  getBestiaryUnlockedCount,
  getAchievementProgress,
} from '../collection/state';
import { ensureCollectionFields } from '../collection/migrate';
import { getAllBestiaryEntries, getAllAchievements } from '../collection/config';

function makeData(overrides?: Partial<TalentSaveData>): TalentSaveData {
  return {
    totalTalentPoints: 0,
    spentTalentPoints: 0,
    talentLevels: {},
    hasPlayedBefore: false,
    ...overrides,
  };
}

describe('collection migration', () => {
  it('ensureCollectionFields fills missing fields', () => {
    const data = makeData();
    ensureCollectionFields(data);
    expect(data.collectionBestiary).toEqual({ enemies: {}, towers: {}, traits: {} });
    expect(data.collectionProgress).toEqual({ totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0 });
    expect(data.collectionCompleted).toEqual([]);
  });

  it('ensureCollectionFields does not overwrite existing data', () => {
    const data = makeData({
      collectionBestiary: { enemies: { snake: true }, towers: {}, traits: {} },
      collectionProgress: { totalKills: 10, totalMerges: 2, totalVictories: 1, highestWave: 8, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0 },
      collectionCompleted: ['first_blood'],
    });
    ensureCollectionFields(data);
    expect(data.collectionBestiary!.enemies).toEqual({ snake: true });
    expect(data.collectionProgress!.totalKills).toBe(10);
    expect(data.collectionCompleted).toEqual(['first_blood']);
  });

  it('ensureCollectionFields repairs corrupted bestiary', () => {
    const data = makeData({ collectionBestiary: null as any });
    ensureCollectionFields(data);
    expect(data.collectionBestiary).toEqual({ enemies: {}, towers: {}, traits: {} });
  });

  it('ensureCollectionFields repairs corrupted progress', () => {
    const data = makeData({ collectionProgress: 'bad' as any });
    ensureCollectionFields(data);
    expect(data.collectionProgress).toEqual({ totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0 });
  });
});

describe('bestiary markSeen/markCrafted', () => {
  it('markEnemySeen returns true on first sight', () => {
    const data = makeData();
    ensureCollectionFields(data);
    expect(markEnemySeen(data, 'snake')).toBe(true);
    expect(isEnemySeen(data, 'snake')).toBe(true);
  });

  it('markEnemySeen returns false on duplicate', () => {
    const data = makeData();
    ensureCollectionFields(data);
    markEnemySeen(data, 'snake');
    expect(markEnemySeen(data, 'snake')).toBe(false);
  });

  it('markTowerCrafted returns true on first craft', () => {
    const data = makeData();
    ensureCollectionFields(data);
    expect(markTowerCrafted(data, 'fire')).toBe(true);
    expect(isTowerCrafted(data, 'fire')).toBe(true);
  });

  it('markTowerCrafted returns false on duplicate', () => {
    const data = makeData();
    ensureCollectionFields(data);
    markTowerCrafted(data, 'fire');
    expect(markTowerCrafted(data, 'fire')).toBe(false);
  });

  it('isEnemySeen returns false for unseen enemy', () => {
    const data = makeData();
    ensureCollectionFields(data);
    expect(isEnemySeen(data, 'boss_dragon')).toBe(false);
  });
});

describe('achievement progress tracking', () => {
  it('addKill increments totalKills', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addKill(data);
    expect(data.collectionProgress!.totalKills).toBe(1);
    addKill(data);
    expect(data.collectionProgress!.totalKills).toBe(2);
  });

  it('addMerge increments totalMerges', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addMerge(data);
    expect(data.collectionProgress!.totalMerges).toBe(1);
  });

  it('updateEndOfRunStats increments victories', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateEndOfRunStats(data, true, 8);
    expect(data.collectionProgress!.totalVictories).toBe(1);
    expect(data.collectionProgress!.highestWave).toBe(8);
  });

  it('updateEndOfRunStats does not lower highestWave', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateEndOfRunStats(data, false, 15);
    updateEndOfRunStats(data, false, 5);
    expect(data.collectionProgress!.highestWave).toBe(15);
  });

  it('updateEndOfRunStats only increments victory on win', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateEndOfRunStats(data, false, 5);
    expect(data.collectionProgress!.totalVictories).toBe(0);
  });
});

describe('evaluateAchievements', () => {
  it('grants first_blood at kill >= 1', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addKill(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('first_blood');
  });

  it('grants wave_5 at highestWave >= 5', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateEndOfRunStats(data, false, 5);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('wave_5');
  });

  it('does not grant achievement twice', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addKill(data);
    evaluateAchievements(data);
    const newly2 = evaluateAchievements(data);
    expect(newly2).not.toContain('first_blood');
  });

  it('grants kill_50 at 50 kills', () => {
    const data = makeData();
    ensureCollectionFields(data);
    for (let i = 0; i < 50; i++) addKill(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('kill_50');
  });

  it('grants first_merge when merge >= 1', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addMerge(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('first_merge');
  });
});

describe('bestiary counts', () => {
  it('getBestiaryUnlockedCount returns zero when empty', () => {
    const data = makeData();
    ensureCollectionFields(data);
    const c = getBestiaryUnlockedCount(data);
    expect(c.total).toBe(0);
  });

  it('getBestiaryUnlockedCount counts correctly', () => {
    const data = makeData();
    ensureCollectionFields(data);
    markEnemySeen(data, 'snake');
    markEnemySeen(data, 'fly');
    markTowerCrafted(data, 'fire');
    const c = getBestiaryUnlockedCount(data);
    expect(c.enemies).toBe(2);
    expect(c.towers).toBe(1);
    expect(c.total).toBe(3);
  });
});

describe('config integrity', () => {
  it('all bestiary entries have unique ids', () => {
    const entries = getAllBestiaryEntries();
    const ids = entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all achievements have unique ids', () => {
    const achievements = getAllAchievements();
    const ids = achievements.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('config has at least 14 bestiary entries', () => {
    expect(getAllBestiaryEntries().length).toBeGreaterThanOrEqual(14);
  });

  it('config has at least 8 achievements', () => {
    expect(getAllAchievements().length).toBeGreaterThanOrEqual(8);
  });

  it('getAchievementProgress returns correct totals', () => {
    const data = makeData();
    ensureCollectionFields(data);
    const p = getAchievementProgress(data);
    expect(p.completed).toBe(0);
    expect(p.total).toBeGreaterThanOrEqual(8);
  });
});

describe('edge cases', () => {
  it('markEnemySeen works when bestiary is completely missing', () => {
    const data = makeData();
    expect(markEnemySeen(data, 'snake')).toBe(true);
  });

  it('evaluateAchievements works on fresh data with no kills', () => {
    const data = makeData();
    ensureCollectionFields(data);
    const newly = evaluateAchievements(data);
    expect(newly).not.toContain('first_blood');
    expect(newly).not.toContain('kill_50');
  });
});
