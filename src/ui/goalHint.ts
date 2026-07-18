// ============================================================
// src/ui/goalHint.ts — 主選單「開始遊戲」上方的下次目標提示
// ============================================================
//
// 由 scenesManager.switchScene('MAIN_MENU') 進場後呼叫 renderGoalHint()。
// 動態將 `.goal-hint-bar` 插入 #btnStartGame 上方（若已存在則原地更新）。
//
// 設計：
//   - 無選目標時顯示灰色「尚未設定下次目標」，不阻擋開始遊戲
//   - 有目標時顯示 emoji + label，並若 mainMenuSeenGoalId 不同則給予淡入提示
//   - 主選單提示只用文字 + emoji；不含動畫素材（保留給 Codex）
//
// 不修改既有 refreshMenuTalentInfo 以避免回歸。

import { gameState } from '../state';
import { getGoalById } from '../goals/config';
import { isGoalCompleted } from '../goals/state';

const HINT_BAR_ID = 'goal-hint-bar';

/**
 * 渲染主選單目標提示列。
 * 若 #btnStartGame 不存在則 no-op（相容於測試或 partial DOM 環境）。
 */
export function renderGoalHint(): void {
  if (typeof document === 'undefined') return;
  const startBtn = document.getElementById('btnStartGame');
  if (!startBtn) return;

  const bar = ensureHintBar(startBtn);
  if (!bar) return;

  const data = gameState.talentData;
  const goal = getGoalById(data.nextGoalId ?? null);

  if (!goal) {
    bar.innerHTML = '<span class="goal-hint-marker" aria-hidden="true">卦</span><span class="goal-hint-empty">尚未設定下次目標（可至五行經脈頁勾選）</span>';
    bar.classList.remove('goal-hint-active', 'goal-hint-completed', 'goal-hint-persistent');
    return;
  }

  const completed = isGoalCompleted(data, goal.id);
  const attempts = data.goalStats?.[goal.id]?.attempts ?? 0;
  const justSeen = data.mainMenuSeenGoalId !== goal.id;
  if (justSeen) {
    data.mainMenuSeenGoalId = goal.id;
  }

  bar.innerHTML = `
    <span class="goal-hint-marker" aria-hidden="true">${goal.emoji}</span>
    <span class="goal-hint-copy"><span class="goal-hint-eyebrow">下次目標</span><span class="goal-hint-label">${goal.label}</span></span>
    ${completed ? '<span class="goal-hint-completed-tag">✓ 已達成</span>' : ''}
    <span class="goal-hint-sub">${goal.description}</span>
  `;
  bar.classList.toggle('goal-hint-active', !completed);
  bar.classList.toggle('goal-hint-completed', completed);
  bar.classList.toggle('goal-hint-fresh', justSeen && !completed);
  bar.classList.toggle('goal-hint-persistent', attempts >= 3 && !completed);
}

/** 取得（或建立）hint bar 元素，並插入到 startBtn 正前方 */
function ensureHintBar(startBtn: HTMLElement): HTMLElement | null {
  let bar = document.getElementById(HINT_BAR_ID) as HTMLElement | null;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = HINT_BAR_ID;
    bar.className = 'goal-hint-bar';
    if (startBtn.parentNode) {
      startBtn.parentNode.insertBefore(bar, startBtn);
    } else {
      return null;
    }
  }
  return bar;
}
