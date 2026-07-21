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
  addTaijiMerge,
  updateHighestAscension,
  updateNoWallCompletion,
  updateSingleElementCompletion,
  updateMaxConsecutivePerfectWaves,
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
    expect(data.collectionProgress).toEqual({ totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0, highestAscension: 0, totalTaijiMerges: 0, noWallCompletions: 0, singleElementCompletions: 0, maxConsecutivePerfectWaves: 0 });
    expect(data.collectionCompleted).toEqual([]);
  });

  it('ensureCollectionFields does not overwrite existing data', () => {
    const data = makeData({
      collectionBestiary: { enemies: { snake: true }, towers: {}, traits: {} },
      collectionProgress: { totalKills: 10, totalMerges: 2, totalVictories: 1, highestWave: 8, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0, highestAscension: 0, totalTaijiMerges: 0, noWallCompletions: 0, singleElementCompletions: 0, maxConsecutivePerfectWaves: 0 },
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
    expect(data.collectionProgress).toEqual({ totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0, highestAscension: 0, totalTaijiMerges: 0, noWallCompletions: 0, singleElementCompletions: 0, maxConsecutivePerfectWaves: 0 });
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
    expect(c.traits).toBe(0);
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
    expect(c.traits).toBe(0);
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

  it('config has 30 bestiary entries (7 enemies + 7 base + 7 Lv2 + 6 recipe + 3 traits)', () => {
    expect(getAllBestiaryEntries().length).toBe(30);
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

  it('bestiary has correct category counts', () => {
    const entries = getAllBestiaryEntries();
    expect(entries.filter(e => e.category === 'enemy').length).toBe(7);
    expect(entries.filter(e => e.category === 'tower').length).toBe(20);
    expect(entries.filter(e => e.category === 'trait').length).toBe(3);
  });

  it('bestiary Lv2 towers have level field and non-recipe have level only', () => {
    const entries = getAllBestiaryEntries();
    const lv2Only = entries.filter(e => e.level != null && e.level >= 2 && !e.recipe);
    expect(lv2Only.length).toBe(7);
    lv2Only.forEach(e => expect(e.category).toBe('tower'));
  });

  it('bestiary recipe towers have recipe flag and level field', () => {
    const entries = getAllBestiaryEntries();
    const recipe = entries.filter(e => e.recipe === true);
    expect(recipe.length).toBe(6);
    recipe.forEach(e => {
      expect(e.category).toBe('tower');
      expect(e.level).toBe(2);
    });
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

describe('silver achievement helper functions', () => {
  it('addTaijiMerge increments totalTaijiMerges', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addTaijiMerge(data);
    expect(data.collectionProgress!.totalTaijiMerges).toBe(1);
    addTaijiMerge(data);
    expect(data.collectionProgress!.totalTaijiMerges).toBe(2);
  });

  it('updateHighestAscension only increases', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateHighestAscension(data, 3);
    expect(data.collectionProgress!.highestAscension).toBe(3);
    updateHighestAscension(data, 1);
    expect(data.collectionProgress!.highestAscension).toBe(3);
    updateHighestAscension(data, 5);
    expect(data.collectionProgress!.highestAscension).toBe(5);
  });

  it('updateNoWallCompletion increments', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateNoWallCompletion(data);
    expect(data.collectionProgress!.noWallCompletions).toBe(1);
  });

  it('updateSingleElementCompletion increments', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateSingleElementCompletion(data);
    expect(data.collectionProgress!.singleElementCompletions).toBe(1);
  });

  it('updateMaxConsecutivePerfectWaves only stores max', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateMaxConsecutivePerfectWaves(data, 3);
    expect(data.collectionProgress!.maxConsecutivePerfectWaves).toBe(3);
    updateMaxConsecutivePerfectWaves(data, 7);
    expect(data.collectionProgress!.maxConsecutivePerfectWaves).toBe(7);
    updateMaxConsecutivePerfectWaves(data, 2);
    expect(data.collectionProgress!.maxConsecutivePerfectWaves).toBe(7);
  });
});

describe('silver achievement evaluation', () => {
  it('grants kill_500 at 500 kills', () => {
    const data = makeData();
    ensureCollectionFields(data);
    for (let i = 0; i < 500; i++) addKill(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('kill_500');
  });

  it('grants merge_30 at 30 merges', () => {
    const data = makeData();
    ensureCollectionFields(data);
    for (let i = 0; i < 30; i++) addMerge(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('merge_30');
  });

  it('grants boss_10 at 10 boss kills', () => {
    const data = makeData();
    ensureCollectionFields(data);
    for (let i = 0; i < 10; i++) {
      addKill(data);
      data.collectionProgress!.bossKills++;
    }
    const newly = evaluateAchievements(data);
    expect(newly).toContain('boss_10');
  });

  it('grants wave_15 at highestWave >= 15', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateEndOfRunStats(data, false, 15);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('wave_15');
  });

  it('grants wave_20_clear only with victory', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateEndOfRunStats(data, false, 20);
    let newly = evaluateAchievements(data);
    expect(newly).not.toContain('wave_20_clear');

    updateEndOfRunStats(data, true, 20);
    newly = evaluateAchievements(data);
    expect(newly).toContain('wave_20_clear');
  });

  it('grants taiji_first on first taiji merge', () => {
    const data = makeData();
    ensureCollectionFields(data);
    addTaijiMerge(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('taiji_first');
  });

  it('grants all_recipes when all 6 recipes discovered', () => {
    const data = makeData();
    ensureCollectionFields(data);
    data.collectionBestiary = {
      enemies: {},
      towers: {
        wood_fire: true, fire_earth: true, earth_metal: true,
        metal_water: true, water_wood: true, yin_yang: true,
      },
      traits: {},
    };
    const newly = evaluateAchievements(data);
    expect(newly).toContain('all_recipes');
  });

  it('grants asc5_clear with highestAscension >= 5 and victory', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateHighestAscension(data, 5);
    updateEndOfRunStats(data, true, 20);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('asc5_clear');
  });

  it('does not grant asc5_clear without victory', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateHighestAscension(data, 5);
    const newly = evaluateAchievements(data);
    expect(newly).not.toContain('asc5_clear');
  });

  it('grants no_wall_clear on first completion', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateNoWallCompletion(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('no_wall_clear');
  });

  it('grants single_element_clear on first completion', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateSingleElementCompletion(data);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('single_element_clear');
  });

  it('grants perfect_5 at 5 consecutive perfect waves', () => {
    const data = makeData();
    ensureCollectionFields(data);
    updateMaxConsecutivePerfectWaves(data, 5);
    const newly = evaluateAchievements(data);
    expect(newly).toContain('perfect_5');
  });

  it('grants full_tower_lv2 when all 7 Lv2 towers unlocked', () => {
    const data = makeData();
    ensureCollectionFields(data);
    data.collectionBestiary = {
      enemies: {},
      towers: {
        fire_2: true, water_2: true, wood_2: true,
        earth_2: true, metal_2: true, yin_2: true, yang_2: true,
      },
      traits: {},
    };
    const newly = evaluateAchievements(data);
    expect(newly).toContain('full_tower_lv2');
  });

  it('does not grant full_tower_lv2 with only recipe towers', () => {
    const data = makeData();
    ensureCollectionFields(data);
    data.collectionBestiary = {
      enemies: {},
      towers: {
        wood_fire: true, fire_earth: true, earth_metal: true,
        metal_water: true, water_wood: true, yin_yang: true,
      },
      traits: {},
    };
    const newly = evaluateAchievements(data);
    expect(newly).not.toContain('full_tower_lv2');
  });

  it('config has 20 achievements total (8 bronze + 12 silver)', () => {
    expect(getAllAchievements().length).toBe(20);
  });

  it('getAchievementProgress reflects 20 total achievements', () => {
    const data = makeData();
    ensureCollectionFields(data);
    const p = getAchievementProgress(data);
    expect(p.total).toBe(20);
  });
});
