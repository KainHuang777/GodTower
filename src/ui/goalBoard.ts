// ============================================================
// src/ui/goalBoard.ts — 跨局紀錄板渲染（純 DOM，不含動畫素材）
// ============================================================
//
// 由 goalSelector.ts 在切換到「紀錄板」分頁時呼叫 renderGoalBoard()。
// 讀取 data.lastBoardSnapshot 與 data.goalStats 渲染：
//   - 當前挑戰目標：文案 + 嘗試次數 + 最近一次結果
//   - 若 requiresVictory 類目標：不顯示 bestWave（F3），改顯示 completed/attempts
//   - 若 justAchieved：顯示「剛剛達成」徽章
//   - 已廢棄目標 id 不顯示（reconcileGoalStats 已清理）
//
// F3 文案守則：abandoned 結果用「中途離開」淺灰、failure 用「嘗試未達」、success 用「已達成」金。

import type { TalentSaveData } from '../talent';
import { getGoalById } from '../goals/config';
import type { BoardSnapshot, GoalRunResult } from '../goals/types';
import { getGoalIconMarkup } from './goalIcons';

const RESULT_TEXT: Record<GoalRunResult, string> = {
  success: '已達成',
  failure: '嘗試未達',
  abandoned: '中途離開',
};

const RESULT_CLASS: Record<GoalRunResult, string> = {
  success: 'goal-result-success',
  failure: 'goal-result-failure',
  abandoned: 'goal-result-abandoned',
};

/**
 * 渲染紀錄板到指定容器。純 DOM；呼叫端負責容器的顯示與切換。
 * 若 lastBoardSnapshot.currentGoalId 為 null，顯示「尚無紀錄」提示。
 */
export function renderGoalBoard(container: HTMLElement, data: TalentSaveData): void {
  const snap: BoardSnapshot | undefined = data.lastBoardSnapshot;
  if (!snap || !snap.currentGoalId) {
    container.innerHTML = `
      <div class="goal-board-empty">
        <div class="goal-board-placeholder">📭 尚無挑戰紀錄</div>
        <div class="goal-board-hint">至「下次目標」勾選一個目標並完成一局後，紀錄板會顯示這裡。</div>
      </div>
    `;
    return;
  }

  const goal = getGoalById(snap.currentGoalId);
  if (!goal) {
    container.innerHTML = '<div class="goal-board-empty">目標資料異常，請稍後再試。</div>';
    return;
  }

  const stats = data.goalStats?.[snap.currentGoalId];
  const attempts = stats?.attempts ?? snap.attempts;
  const requiresVictory = goal.completion.requiresVictory === true;
  const resultLabel = snap.lastResult ? RESULT_TEXT[snap.lastResult] : '尚未嘗試';
  const resultClass = snap.lastResult ? RESULT_CLASS[snap.lastResult] : 'goal-result-none';

  container.innerHTML = `
    <div class="goal-board-card${snap.completed ? ' goal-board-completed' : ''}">
      <div class="goal-board-head">
        <span class="goal-board-seal" aria-hidden="true">${getGoalIconMarkup(goal.id)}</span>
        <span class="goal-board-label">${goal.label}</span>
        <span class="goal-board-badges">
          ${snap.completed ? '<span class="goal-board-tag">✓ 已達成</span>' : ''}
          ${snap.justAchieved ? '<span class="goal-board-fresh">剛剛達成！</span>' : ''}
        </span>
      </div>
      <div class="goal-board-desc">${goal.description}</div>
      <div class="goal-board-stats">
        <div class="goal-stat-row">
          <span class="goal-stat-label">已嘗試</span>
          <span class="goal-stat-value">${attempts} 次</span>
        </div>
        <div class="goal-stat-row">
          <span class="goal-stat-label">最近結果</span>
          <span class="goal-stat-value ${resultClass}">${resultLabel}</span>
        </div>
        ${!requiresVictory ? `
        <div class="goal-stat-row">
          <span class="goal-stat-label">最佳波次</span>
          <span class="goal-stat-value">${snap.lastBestWave}</span>
        </div>` : `
        <div class="goal-stat-row">
          <span class="goal-stat-label">通關挑戰</span>
          <span class="goal-stat-value">${snap.completed ? '已通關成功' : '尚在挑戰中'}</span>
        </div>`}
      </div>
    </div>
  `;
}
