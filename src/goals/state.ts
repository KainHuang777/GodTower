// ============================================================
// src/goals/state.ts — 目標系統純函式
// ============================================================
//
// 所有純函式均接受外部資料並回傳新值或原地 mutation（依 API 慣例），
// 不讀寫 localStorage、不存取 DOM、不觸發 scene 切換。
// 渲染層與邏輯層共享這些函式，避免重複實作判斷。

import type { TalentSaveData } from '../talent';
import type {
  BoardSnapshot,
  GoalCompletionKey,
  GoalDefinition,
  GoalId,
  GoalRunResult,
  GoalStats,
  RunStats,
} from './types';
import { getGoalById, getGoalConfigVersion, validateGoalId } from './config';

/**
 * 比較 runStats 與目標完成條件。
 * 純函式：給定同一組 (goal, runStats) 永遠回傳同一結果。
 */
export function evaluateGoalCompletion(goal: GoalDefinition, runStats: RunStats): boolean {
  if (goal.completion.requiresVictory === true && !runStats.isVictory) return false;

  const value = (runStats as Record<GoalCompletionKey, number>)[goal.completion.key];
  if (typeof value !== 'number' || Number.isNaN(value)) return false;

  switch (goal.completion.operator) {
    case 'gte':
      return value >= goal.completion.value;
    case 'lte':
      return value <= goal.completion.value;
    case 'eq':
      return value === goal.completion.value;
    default:
      return false;
  }
}

/**
 * 設定玩家「下次目標」。原地 mutation data，並回傳原 data 引用方便鏈式呼叫。
 * 無效 goalId 會被靜默忽略（不改動 data），由呼叫端決定是否提示玩家。
 *
 * @param data 玩家長期存檔
 * @param goalId 新選的目標 id；null 表示取消勾選
 */
export function selectGoal(data: TalentSaveData, goalId: GoalId | null): TalentSaveData {
  if (goalId !== null && validateGoalId(goalId) === null) {
    return data; // 無效 id，不變更
  }
  data.nextGoalId = goalId;
  data.nextGoalVersion = getGoalConfigVersion();
  return data;
}

/**
 * 以本局 RunStats 更新指定目標的 goalStats。原地 mutation。
 * 若 goalId 為 null 或失效，直接回傳原 data（未開局挑目標 → 不記錄）。
 *
 * @param data 玩家長期存檔
 * @param goalId 結算時正在挑戰的目標 id
 * @param runStats 本局統計快照
 * @param result 結果分類；通常為 'success' 或 'failure'
 * @param now 當前時間戳（傳入以便測試固定時間）
 * @returns 是否本局剛完成該目標（justAchieved），用於觸發慶祝 callback
 */
export function updateGoalStats(
  data: TalentSaveData,
  goalId: GoalId | null,
  runStats: RunStats,
  result: GoalRunResult,
  now: number,
): boolean {
  if (goalId === null || validateGoalId(goalId) === null) return false;

  if (!data.goalStats) data.goalStats = {};
  const goal = getGoalById(goalId);
  if (!goal) return false;

  const prev: GoalStats = data.goalStats[goalId] ?? {
    attempts: 0,
    lastResult: null,
    lastAttemptAt: null,
    bestWave: 0,
    completed: false,
  };

  const isCompleted = evaluateGoalCompletion(goal, runStats);

  data.goalStats[goalId] = {
    attempts: prev.attempts + 1,
    lastResult: result,
    lastAttemptAt: now,
    bestWave: Math.max(prev.bestWave, runStats.highestWave),
    completed: prev.completed || isCompleted,
  };

  return isCompleted && !prev.completed; // justAchieved
}

/**
 * 合併本局新增的波次里程碑到跨局累積集合。
 * 純函式：輸入相同回傳相同（新陣列）。
 *
 * @param existing 既有累積值（data.goalMilestones）
 * @param newMilestones 本局新達成的波次門檻（如 [5, 10, 15]）
 * @returns 去重並排序後的新陣列
 */
export function mergeMilestones(existing: number[], newMilestones: number[]): number[] {
  const set = new Set<number>(existing);
  for (const m of newMilestones) {
    if (Number.isFinite(m) && m > 0) set.add(Math.floor(m));
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * 為指定目標產生紀錄板渲染快照。純函式。
 * 若 goalId 為 null 或失效，回傳「空快照」（currentGoalId=null, 其他全為預設）。
 *
 * @param data 玩家長期存檔
 * @param goalId 結算時正在挑戰的目標 id（可能為 null）
 * @param justAchieved 本局是否剛完成該目標（由 updateGoalStats 回傳）
 */
export function buildBoardSnapshot(
  data: TalentSaveData,
  goalId: GoalId | null,
  justAchieved: boolean,
): BoardSnapshot {
  if (!goalId || validateGoalId(goalId) === null || !data.goalStats) {
    return {
      currentGoalId: null,
      attempts: 0,
      lastResult: null,
      lastBestWave: 0,
      completed: false,
      justAchieved: false,
      version: getGoalConfigVersion(),
    };
  }

  const stats: GoalStats = data.goalStats[goalId] ?? {
    attempts: 0,
    lastResult: null,
    lastAttemptAt: null,
    bestWave: 0,
    completed: false,
  };

  return {
    currentGoalId: goalId,
    attempts: stats.attempts,
    lastResult: stats.lastResult,
    lastBestWave: stats.bestWave,
    completed: stats.completed,
    justAchieved,
    version: getGoalConfigVersion(),
  };
}

/**
 * 判定目標對玩家是否已解鎖。
 * 純函式：依據玩家長期資料（含 ascension/runs）與目標解鎖條件比較。
 *
 * @param goal 目標定義
 * @param ascensionLevel 當前 Ascension 層級
 * @param runsCompleted 累計完成局數（勝利局）
 */
export function isGoalUnlocked(
  goal: GoalDefinition,
  ascensionLevel: number,
  runsCompleted: number,
): boolean {
  if (!goal.unlock) return true;
  if (goal.unlock.minAscension !== undefined && ascensionLevel < goal.unlock.minAscension) {
    return false;
  }
  if (goal.unlock.minRunsCompleted !== undefined && runsCompleted < goal.unlock.minRunsCompleted) {
    return false;
  }
  return true;
}

/**
 * 判定玩家是否已「完成過」該目標。
 * 純函式：基於 data.goalStats[goalId].completed。
 */
export function isGoalCompleted(data: TalentSaveData, goalId: GoalId): boolean {
  if (!data.goalStats) return false;
  return data.goalStats[goalId]?.completed === true;
}

/**
 * 結算「單筆交易」整合 API：依序呼叫 updateGoalStats → buildBoardSnapshot，
 * 並在成功時寫回 data.lastBoardSnapshot。回傳 { justAchieved, snapshot }。
 *
 * 用於避免 caller 漏掉順序或遺漏 buildBoardSnapshot 寫回。endBattle 應優先呼叫此 API，
 * 而非分開呼叫 updateGoalStats + buildBoardSnapshot。
 *
 * @returns justAchieved=true 表示玩家本局剛完成此目標（且之前未完成）— UI 可觸發慶祝 callback。
 *          snapshot 寫回 data.lastBoardSnapshot，同時回傳給 caller。
 */
export function commitEndOfRun(
  data: TalentSaveData,
  goalId: GoalId | null,
  runStats: RunStats,
  result: GoalRunResult,
  now: number,
): { justAchieved: boolean; snapshot: BoardSnapshot } {
  const justAchieved = updateGoalStats(data, goalId, runStats, result, now);
  const snapshot = buildBoardSnapshot(data, goalId, justAchieved);
  data.lastBoardSnapshot = snapshot;
  return { justAchieved, snapshot };
}