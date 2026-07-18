// ============================================================
// src/goals/config.ts — goals.json 載入與查詢
// ============================================================
//
// 單一資料來源：所有目標查詢都走此模組，禁止其他層直接 import JSON。
// 純函式，無副作用，可被任意測試 mock。

import goalConfigJson from '../config/goals.json';
import type { GoalConfig, GoalDefinition, GoalId } from './types';

export const GOAL_CONFIG: GoalConfig = goalConfigJson as GoalConfig;

/**
 * 由 id 查詢目標定義；找不到回傳 null。
 * 呼叫端應以回傳 null 視為「目標已失效」，並 fallback 到 null 狀態。
 */
export function getGoalById(id: GoalId | null | undefined): GoalDefinition | null {
  if (!id) return null;
  return GOAL_CONFIG.goals.find(goal => goal.id === id) ?? null;
}

/** 取得所有目標定義，UI 渲染時應使用此函式取得不可變快照 */
export function getAllGoals(): GoalDefinition[] {
  return [...GOAL_CONFIG.goals];
}

/**
 * 驗證目標 id 是否存在於當前版本的目標清單。
 * 用於：
 * - loadTalentData 時將舊存檔指向已刪目標的 nextGoalId 清成 null
 * - 玩家透過任意路徑（如 devtools）寫入非法 id 時的防呆
 *
 * 回傳原 id（若有效）或 null（若失效）。
 */
export function validateGoalId(id: GoalId | null | undefined): GoalId | null {
  if (!id) return null;
  return getGoalById(id) ? id : null;
}

/** 目標設定檔版本戳，供舊存檔 migration 比對 */
export function getGoalConfigVersion(): string {
  return GOAL_CONFIG.version;
}