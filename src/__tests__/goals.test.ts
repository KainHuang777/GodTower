import { describe, expect, it } from 'vitest';
import type { TalentSaveData } from '../talent';
import { GOAL_CONFIG } from '../goals/config';
import { getGoalById, getAllGoals, validateGoalId, getGoalConfigVersion } from '../goals/config';
import {
  commitEndOfRun,
  evaluateGoalCompletion,
  selectGoal,
  updateGoalStats,
  mergeMilestones,
  buildBoardSnapshot,
  isGoalUnlocked,
  isGoalCompleted,
} from '../goals/state';
import { ensureGoalFields, reconcileGoalStats } from '../goals/migrate';
import { createEmptyBoardSnapshot } from '../goals/types';
import type { GoalDefinition, RunStats } from '../goals/types';

function makeSaveData(overrides: Partial<TalentSaveData> = {}): TalentSaveData {
  return {
    totalTalentPoints: 0,
    spentTalentPoints: 0,
    talentLevels: {},
    personalBest: 0,
    milestones: [],
    completedAchievements: [],
    achievementCount: 0,
    totalDamageDealt: 0,
    resetCount: 0,
    nextGoalId: null,
    nextGoalVersion: getGoalConfigVersion(),
    goalStats: {},
    goalMilestones: [],
    lastBoardSnapshot: createEmptyBoardSnapshot(),
    mainMenuSeenGoalId: null,
    ritualEnabled: true,
    ...overrides,
  };
}

function makeRunStats(overrides: Partial<RunStats> = {}): RunStats {
  const base: RunStats = {
    highestWave: 10,
    clearedAllWaves: 0,
    isVictory: false,
    mergeCount: 0,
    wuxingElementCount: 1,
    combatTowerCount: 5,
    clearTimeMinutes: 0,
    ascensionLevel: 0,
    killCount: 50,
  };
  if (overrides.isVictory === true && overrides.clearedAllWaves === undefined) {
    base.clearedAllWaves = 1;
  }
  return Object.assign(base, overrides);
}

describe('goals config', () => {
  it('ships v1 with 8 goals and a stable version stamp', () => {
    expect(GOAL_CONFIG.goals.length).toBe(8);
    expect(GOAL_CONFIG.version).toBe('1.0.0');
    for (const goal of GOAL_CONFIG.goals) {
      expect(typeof goal.id).toBe('string');
      expect(typeof goal.label).toBe('string');
      expect(typeof goal.completion.key).toBe('string');
    }
  });

  it('returns the matching definition by id', () => {
    expect(getGoalById('reach_wave_15')?.id).toBe('reach_wave_15');
  });

  it('returns null for unknown id', () => {
    expect(getGoalById('does_not_exist')).toBeNull();
    expect(getGoalById(null)).toBeNull();
    expect(getGoalById(undefined)).toBeNull();
  });

  it('getAllGoals returns a fresh array snapshot each call', () => {
    const a = getAllGoals();
    const b = getAllGoals();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('validateGoalId echoes valid id and nullifies invalid', () => {
    expect(validateGoalId('reach_wave_15')).toBe('reach_wave_15');
    expect(validateGoalId('gone')).toBeNull();
    expect(validateGoalId(null)).toBeNull();
  });
});

describe('evaluateGoalCompletion', () => {
  const reach = getGoalById('reach_wave_15')!;
  const synth = getGoalById('synthesis_master')!;
  const minimal = getGoalById('minimalist')!;

  it('satisfies reach_wave_15 when wave >= 15 regardless of victory', () => {
    expect(evaluateGoalCompletion(reach, makeRunStats({ highestWave: 15 }))).toBe(true);
    expect(evaluateGoalCompletion(reach, makeRunStats({ highestWave: 14 }))).toBe(false);
    expect(evaluateGoalCompletion(reach, makeRunStats({ highestWave: 15, isVictory: false }))).toBe(true);
  });

  it('satisfies synthesis_master at threshold 8', () => {
    expect(evaluateGoalCompletion(synth, makeRunStats({ mergeCount: 8 }))).toBe(true);
    expect(evaluateGoalCompletion(synth, makeRunStats({ mergeCount: 7 }))).toBe(false);
  });

  it('rejects minimalist when victory is required but not achieved', () => {
    expect(evaluateGoalCompletion(minimal, makeRunStats({ isVictory: false, combatTowerCount: 2 }))).toBe(false);
    expect(evaluateGoalCompletion(minimal, makeRunStats({ isVictory: true, combatTowerCount: 6 }))).toBe(true);
    expect(evaluateGoalCompletion(minimal, makeRunStats({ isVictory: true, combatTowerCount: 7 }))).toBe(false);
  });

  it('rejects when runStats value is NaN', () => {
    const goal: GoalDefinition = { ...reach, completion: { key: 'highestWave', operator: 'gte', value: 5 } };
    const stats = makeRunStats();
    stats.highestWave = Number.NaN;
    expect(evaluateGoalCompletion(goal, stats)).toBe(false);
  });

  it('eq operator matches exact value with requiresVictory gate (clear_20_boss / asc2_clear)', () => {
    const clear20 = getGoalById('clear_20_boss')!;
    expect(evaluateGoalCompletion(clear20, makeRunStats({ isVictory: true }))).toBe(true);
    expect(evaluateGoalCompletion(clear20, makeRunStats({ isVictory: false }))).toBe(false);
  });

  it('lte operator inclusive boundary +/-0.1 (speed_clear)', () => {
    const speed = getGoalById('speed_clear')!;
    expect(evaluateGoalCompletion(speed, makeRunStats({ isVictory: true, clearTimeMinutes: 5 }))).toBe(true);
    expect(evaluateGoalCompletion(speed, makeRunStats({ isVictory: true, clearTimeMinutes: 4.9 }))).toBe(true);
    expect(evaluateGoalCompletion(speed, makeRunStats({ isVictory: true, clearTimeMinutes: 5.1 }))).toBe(false);
  });

  it('asc2_clear simultaneously requires clearedAllWaves and ascensionLevel unlock gate at evaluation time', () => {
    const asc2 = getGoalById('asc2_clear')!;
    expect(evaluateGoalCompletion(asc2, makeRunStats({ isVictory: true, ascensionLevel: 2 }))).toBe(true);
    expect(evaluateGoalCompletion(asc2, makeRunStats({ isVictory: false, ascensionLevel: 5 }))).toBe(false);
  });
});

describe('selectGoal', () => {
  it('sets nextGoalId and stamps version', () => {
    const data = makeSaveData();
    selectGoal(data, 'reach_wave_15');
    expect(data.nextGoalId).toBe('reach_wave_15');
    expect(data.nextGoalVersion).toBe(getGoalConfigVersion());
  });

  it('allows clearing goal with null', () => {
    const data = makeSaveData({ nextGoalId: 'reach_wave_15' });
    selectGoal(data, null);
    expect(data.nextGoalId).toBeNull();
  });

  it('silently ignores invalid goalId', () => {
    const data = makeSaveData({ nextGoalId: 'reach_wave_15' });
    selectGoal(data, 'invalid_id_xyz');
    expect(data.nextGoalId).toBe('reach_wave_15'); // 未被覆蓋
  });
});

describe('updateGoalStats', () => {
  it('increments attempts and records lastResult', () => {
    const data = makeSaveData();
    const justAchieved = updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 10 }), 'failure', 1000);
    expect(justAchieved).toBe(false);
    expect(data.goalStats!['reach_wave_15']).toEqual({
      attempts: 1,
      lastResult: 'failure',
      lastAttemptAt: 1000,
      bestWave: 10,
      completed: false,
    });
  });

  it('marks justAchieved=true on first completion and stays completed after', () => {
    const data = makeSaveData();
    const first = updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 20 }), 'success', 1000);
    expect(first).toBe(true);
    expect(data.goalStats!['reach_wave_15'].completed).toBe(true);

    const second = updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 5 }), 'failure', 2000);
    expect(second).toBe(false); // 已完成過，not justAchieved
    expect(data.goalStats!['reach_wave_15'].completed).toBe(true);
    expect(data.goalStats!['reach_wave_15'].attempts).toBe(2);
    // bestWave 保留歷史最大值，不被本局較低波次覆蓋
    expect(data.goalStats!['reach_wave_15'].bestWave).toBe(20);
  });

  it('no-ops when goalId is null', () => {
    const data = makeSaveData();
    const r = updateGoalStats(data, null, makeRunStats(), 'failure', 1000);
    expect(r).toBe(false);
    expect(data.goalStats).toEqual({});
  });

  it('no-ops when goalId is invalid', () => {
    const data = makeSaveData();
    const r = updateGoalStats(data, 'does_not_exist', makeRunStats(), 'failure', 1000);
    expect(r).toBe(false);
    expect(data.goalStats).toEqual({});
  });

  it('bestWave retains historical max across failure runs', () => {
    const data = makeSaveData();
    updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 15 }), 'success', 1000);
    updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 8 }), 'failure', 2000);
    const final = updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 12 }), 'failure', 3000);
    expect(final).toBe(false);
    expect(data.goalStats!['reach_wave_15'].bestWave).toBe(15);
  });
});

describe('commitEndOfRun', () => {
  it('atomically updates goalStats + writes lastBoardSnapshot, returns justAchieved + snapshot', () => {
    const data = makeSaveData();
    selectGoal(data, 'reach_wave_15');
    const { justAchieved, snapshot } = commitEndOfRun(data, 'reach_wave_15', makeRunStats({ highestWave: 20 }), 'success', 123);
    expect(justAchieved).toBe(true);
    expect(snapshot.currentGoalId).toBe('reach_wave_15');
    expect(snapshot.justAchieved).toBe(true);
    expect(data.lastBoardSnapshot).toBe(snapshot);
    expect(data.goalStats!['reach_wave_15'].attempts).toBe(1);
  });

  it('no-ops atomically when goalId is null (snapshot is empty, stats untouched)', () => {
    const data = makeSaveData();
    const before = data.lastBoardSnapshot;
    const { justAchieved, snapshot } = commitEndOfRun(data, null, makeRunStats(), 'failure', 100);
    expect(justAchieved).toBe(false);
    expect(snapshot.currentGoalId).toBeNull();
    expect(data.goalStats).toEqual({});
    // 即使空快照仍寫回，以反映「沒有挑戰中目標」狀態
    expect(data.lastBoardSnapshot).toBe(snapshot);
    expect(data.lastBoardSnapshot).not.toBe(before);
  });
});

describe('mergeMilestones', () => {
  it('unions and sorts milestones, dedupes duplicates', () => {
    expect(mergeMilestones([5, 10], [10, 15])).toEqual([5, 10, 15]);
    expect(mergeMilestones([], [20, 5, 10])).toEqual([5, 10, 20]);
    expect(mergeMilestones([5], [])).toEqual([5]);
  });

  it('drops non-finite and non-positive values', () => {
    expect(mergeMilestones([5], [Number.NaN, -3, 0, 10])).toEqual([5, 10]);
  });

  it('returns a new array, does not mutate input', () => {
    const existing = [5, 10];
    const result = mergeMilestones(existing, [15]);
    expect(existing).toEqual([5, 10]);
    expect(result).not.toBe(existing);
  });
});

describe('buildBoardSnapshot', () => {
  it('returns empty snapshot when no goal selected', () => {
    const data = makeSaveData();
    const snap = buildBoardSnapshot(data, null, false);
    expect(snap.currentGoalId).toBeNull();
    expect(snap.attempts).toBe(0);
    expect(snap.completed).toBe(false);
    expect(snap.justAchieved).toBe(false);
    expect(snap.version).toBe(getGoalConfigVersion());
  });

  it('returns empty snapshot when goalId invalid', () => {
    const data = makeSaveData();
    const snap = buildBoardSnapshot(data, 'gone_id', false);
    expect(snap.currentGoalId).toBeNull();
  });

  it('reads from goalStats when present', () => {
    const data = makeSaveData({
      goalStats: { reach_wave_15: { attempts: 3, lastResult: 'failure', lastAttemptAt: 1234, bestWave: 12, completed: false } },
    });
    const snap = buildBoardSnapshot(data, 'reach_wave_15', true);
    expect(snap).toEqual({
      currentGoalId: 'reach_wave_15',
      attempts: 3,
      lastResult: 'failure',
      lastBestWave: 12,
      completed: false,
      justAchieved: true,
      version: getGoalConfigVersion(),
    });
  });
});

describe('isGoalUnlocked & isGoalCompleted', () => {
  it('unlocks goal without unlock requirement always', () => {
    const goal = getGoalById('reach_wave_15')!;
    expect(isGoalUnlocked(goal, 0, 0)).toBe(true);
  });

  it('respects minAscension requirement', () => {
    const goal = getGoalById('asc2_clear')!;
    expect(isGoalUnlocked(goal, 1, 0)).toBe(false);
    expect(isGoalUnlocked(goal, 2, 0)).toBe(true);
    expect(isGoalUnlocked(goal, 5, 0)).toBe(true);
  });

  it('respects minRunsCompleted requirement', () => {
    const goal = getGoalById('clear_20_boss')!;
    expect(isGoalUnlocked(goal, 0, 0)).toBe(false);
    expect(isGoalUnlocked(goal, 0, 1)).toBe(true);
  });

  it('isGoalCompleted false when no stats present', () => {
    const data = makeSaveData();
    expect(isGoalCompleted(data, 'reach_wave_15')).toBe(false);
  });

  it('isGoalCompleted true after completion flagged', () => {
    const data = makeSaveData();
    updateGoalStats(data, 'reach_wave_15', makeRunStats({ highestWave: 20 }), 'success', 1);
    expect(isGoalCompleted(data, 'reach_wave_15')).toBe(true);
  });
});

describe('ensureGoalFields & reconcileGoalStats', () => {
  it('ensureGoalFields fills all defaults via ??=', () => {
    const raw = { totalTalentPoints: 1, spentTalentPoints: 0, talentLevels: {} } as unknown as TalentSaveData;
    ensureGoalFields(raw);
    expect(raw.nextGoalId).toBeNull();
    expect(raw.nextGoalVersion).toBe(getGoalConfigVersion());
    expect(raw.goalStats).toEqual({});
    expect(raw.goalMilestones).toEqual([]);
    expect(raw.lastBoardSnapshot).toEqual(createEmptyBoardSnapshot());
    expect(raw.mainMenuSeenGoalId).toBeNull();
    expect(raw.ritualEnabled).toBe(true);
  });

  it('ensureGoalFields preserves existing values', () => {
    const existingStats = { reach_wave_15: { attempts: 2, lastResult: 'failure', lastAttemptAt: 99, bestWave: 7, completed: false } };
    const raw = ({
      totalTalentPoints: 1,
      spentTalentPoints: 0,
      talentLevels: {},
      nextGoalId: 'reach_wave_15',
      goalStats: existingStats,
      ritualEnabled: false,
    } as unknown) as TalentSaveData;
    ensureGoalFields(raw);
    expect(raw.nextGoalId).toBe('reach_wave_15');
    expect(raw.goalStats).toBe(existingStats);
    expect(raw.ritualEnabled).toBe(false);
  });

  it('ensureGoalFields nullifies nextGoalId pointing to removed goal', () => {
    const raw = ({
      totalTalentPoints: 1,
      spentTalentPoints: 0,
      talentLevels: {},
      nextGoalId: 'removed_goal_id',
    } as unknown) as TalentSaveData;
    ensureGoalFields(raw);
    expect(raw.nextGoalId).toBeNull();
  });

  it('ensureGoalFields replaces malformed goalStats (string/number/array) with empty object', () => {
    for (const malformed of ['[]', 42, [1, 2, 3]]) {
      const raw = ({
        totalTalentPoints: 1,
        spentTalentPoints: 0,
        talentLevels: {},
        goalStats: malformed,
      } as unknown) as TalentSaveData;
      ensureGoalFields(raw);
      expect(raw.goalStats).toEqual({});
      expect(Array.isArray(raw.goalStats)).toBe(false);
    }
  });

  it('reconcileGoalStats removes obsolete ids and updates version', () => {
    const raw = makeSaveData({
      nextGoalVersion: '0.9.0',
      goalStats: {
        reach_wave_15: { attempts: 1, lastResult: 'failure', lastAttemptAt: 1, bestWave: 5, completed: false },
        obsolete_id: { attempts: 9, lastResult: 'success', lastAttemptAt: 1, bestWave: 20, completed: true },
      },
    });
    const cleaned = reconcileGoalStats(raw);
    expect(cleaned).toBe(true);
    expect(raw.goalStats!['obsolete_id']).toBeUndefined();
    expect(raw.goalStats!['reach_wave_15']).toBeDefined();
    expect(raw.nextGoalVersion).toBe(getGoalConfigVersion());
  });

  it('reconcileGoalStats returns false when nothing to clean', () => {
    const raw = makeSaveData({
      goalStats: { reach_wave_15: { attempts: 1, lastResult: 'failure', lastAttemptAt: 1, bestWave: 5, completed: false } },
    });
    const cleaned = reconcileGoalStats(raw);
    expect(cleaned).toBe(false);
  });

  it('reconcileGoalStats handles missing goalStats gracefully', () => {
    const raw = makeSaveData();
    delete raw.goalStats;
    const cleaned = reconcileGoalStats(raw);
    expect(cleaned).toBe(false);
    expect(raw.nextGoalVersion).toBe(getGoalConfigVersion());
  });
});