import { describe, expect, it } from 'vitest';
import { getGoalById } from '../goals/config';
import type { RunStats } from '../goals/types';
import { buildGoalRunFeedback } from '../ui/goalRunResult';

const baseStats: RunStats = {
  highestWave: 1,
  clearedAllWaves: 0,
  isVictory: false,
  mergeCount: 0,
  wuxingElementCount: 0,
  combatTowerCount: 0,
  clearTimeMinutes: 0,
  ascensionLevel: 0,
  killCount: 0,
  // v2 新增欄位
  mapId: 'level_1',
  difficultyLevel: 1,
  difficultyName: 'normal',
  yinYangTowerCount: 0,
  synthesisRecipeCount: 0,
  damageTaken: 0,
  noDamageTaken: 1,
  specificEnemyKills: {},
  traitsEncountered: {},
};

describe('buildGoalRunFeedback', () => {
  const waveGoal = getGoalById('reach_wave_15')!;

  it('celebrates a newly completed goal', () => {
    const feedback = buildGoalRunFeedback(waveGoal, { ...baseStats, highestWave: 15 }, true);
    expect(feedback.kind).toBe('achieved');
    expect(feedback.title).toContain('目標達成');
    expect(feedback.detail).toContain('首次完成');
  });

  it('shows a near miss when a measurable target reaches 80%', () => {
    const feedback = buildGoalRunFeedback(waveGoal, { ...baseStats, highestWave: 14 }, false);
    expect(feedback.kind).toBe('near');
    expect(feedback.detail).toBe('波次 14／目標 15');
  });

  it('keeps victory-required goals in the ongoing state before a win', () => {
    const victoryGoal = getGoalById('clear_20_boss')!;
    const feedback = buildGoalRunFeedback(victoryGoal, { ...baseStats, highestWave: 20 }, false);
    expect(feedback.kind).toBe('ongoing');
    expect(feedback.detail).toContain('完成最終波次');
  });
});
