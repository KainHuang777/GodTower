// ============================================================
// src/goals/migrate.ts — TalentSaveData 補欄位與跨版本清理
// ============================================================
//
// 在 loadTalentData 載入舊存檔後呼叫一次 ensureGoalFields，
// 並於 version 演進（nextGoalVersion 與 GOAL_CONFIG.version 不同）時呼叫 reconcileGoalStats。
//
// 純函式：接受 TalentSaveData 原地 mutation 並回傳，無 IO、無副作用。

import type { TalentSaveData } from '../talent';
import { getGoalConfigVersion, validateGoalId } from './config';
import { createEmptyBoardSnapshot } from './types';

/**
 * 為舊存檔補上所有目標相關欄位的預設值。
 * 採 ??= 模式，與既有 loadTalentData 中 personalBest/totalDamageDealt 補欄位一致。
 * 同時驗證 nextGoalId；若指向已刪目標，清成 null。
 */
export function ensureGoalFields(data: TalentSaveData): void {
  data.nextGoalId ??= null;
  data.nextGoalVersion ??= getGoalConfigVersion();
  // 防禦：舊存檔可能被外部寫入非物件形態（string/number/array）。??= 只在 null/undefined 觸發，
  // 故顯式 guard 以避免後續 `data.goalStats[id]` 寫入時 runtime crash。
  if (data.goalStats == null
    || typeof data.goalStats !== 'object'
    || Array.isArray(data.goalStats)) {
    data.goalStats = {};
  }
  data.goalMilestones ??= [];
  data.lastBoardSnapshot ??= createEmptyBoardSnapshot();
  data.mainMenuSeenGoalId ??= null;
  data.ritualEnabled ??= true;
  data.formalRunsCompleted ??= 0;

  // 清掉指向已刪目標的 nextGoalId
  data.nextGoalId = validateGoalId(data.nextGoalId);
}

/**
 * 當目標設定檔版本演進時，清除 goalStats 中已失效的目標 id 金鑰。
 * 保留歷史 attempts/bestWave 對所有仍存在 id 不變。
 *
 * 呼叫時機：loadTalentData 發現 data.nextGoalVersion !== GOAL_CONFIG.version。
 *
 * @returns 是否清理過任何失效 id（用於測試斷言）
 */
export function reconcileGoalStats(data: TalentSaveData): boolean {
  if (!data.goalStats) {
    data.nextGoalVersion = getGoalConfigVersion();
    return false;
  }

  let cleaned = false;
  for (const id of Object.keys(data.goalStats)) {
    if (validateGoalId(id) === null) {
      delete data.goalStats[id];
      cleaned = true;
    }
  }

  data.nextGoalVersion = getGoalConfigVersion();
  return cleaned;
}