// ============================================================
// src/ui/goalRunResult.ts — GAME_OVER 目標挑戰回饋（F4）
// ============================================================

import { getGoalById } from '../goals/config';
import { evaluateGoalCompletion } from '../goals/state';
import type { GoalDefinition, RunStats } from '../goals/types';
import { playSFX } from '../audio/audioSystem';

export type GoalRunFeedbackKind = 'achieved' | 'near' | 'ongoing';

export interface GoalRunFeedback {
  kind: GoalRunFeedbackKind;
  title: string;
  detail: string;
}

export interface GoalRunFeedbackContext {
  goalId: string;
  runStats: RunStats;
  justAchieved: boolean;
}

const METRIC_LABEL: Partial<Record<keyof RunStats, string>> = {
  highestWave: '波次',
  killCount: '擊殺',
  mergeCount: '合成',
  wuxingElementCount: '五行元素',
  combatTowerCount: '實戰塔',
  clearTimeMinutes: '通關時間',
  ascensionLevel: '難度層級',
};

/** 產生結算頁的三態目標回饋；不寫入存檔，也不依賴 DOM。 */
export function buildGoalRunFeedback(
  goal: GoalDefinition,
  runStats: RunStats,
  justAchieved: boolean,
): GoalRunFeedback {
  if (evaluateGoalCompletion(goal, runStats)) {
    return {
      kind: 'achieved',
      title: `🎉 目標達成：${goal.label}！`,
      detail: justAchieved ? '本局首次完成此目標，已記入紀錄板。' : '本局再次完成此目標。',
    };
  }

  const progress = describeProgress(goal, runStats);
  if (isNearCompletion(goal, runStats)) {
    return { kind: 'near', title: '🔥 差一點！', detail: progress };
  }

  return { kind: 'ongoing', title: `📜 挑戰中：${goal.label}`, detail: progress };
}

/** 將目標回饋安全渲染至既有 GAME_OVER 容器。 */
export function renderGoalRunResult(context: GoalRunFeedbackContext | null): void {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('goalRunResult');
  if (!container) return;

  if (!context) {
    container.hidden = true;
    replaceContainerChildren(container);
    return;
  }

  const goal = getGoalById(context.goalId);
  if (!goal) {
    container.hidden = true;
    replaceContainerChildren(container);
    return;
  }

  const feedback = buildGoalRunFeedback(goal, context.runStats, context.justAchieved);
  const title = document.createElement('div');
  title.className = 'goal-run-result-title';
  title.textContent = feedback.title;
  const detail = document.createElement('div');
  detail.className = 'goal-run-result-detail';
  detail.textContent = feedback.detail;

  container.className = `goal-run-result goal-run-result-${feedback.kind}`;
  container.hidden = false;
  const celebration = context.justAchieved && feedback.kind === 'achieved'
    ? createGoalCelebration()
    : null;
  replaceContainerChildren(container, ...(celebration ? [celebration, title, detail] : [title, detail]));
  if (celebration) {
    try { playSFX('merge_success'); } catch { /* 音效不可用時保持無聲 */ }
  }
}

function createGoalCelebration(): HTMLElement {
  const burst = document.createElement('div');
  burst.className = 'goal-celebration-burst';
  for (let index = 0; index < 10; index++) {
    const particle = document.createElement('i');
    const angle = (Math.PI * 2 * index) / 10;
    particle.style.setProperty('--burst-x', `${Math.cos(angle) * (34 + (index % 3) * 8)}px`);
    particle.style.setProperty('--burst-y', `${Math.sin(angle) * (20 + (index % 2) * 12)}px`);
    particle.style.animationDelay = `${index * 24}ms`;
    burst.appendChild(particle);
  }
  return burst;
}

/** 相容於瀏覽器 DOM 與舊測試中的最小 mock 元素。 */
function replaceContainerChildren(container: HTMLElement, ...children: Node[]): void {
  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(...children);
    return;
  }
  container.textContent = '';
  for (const child of children) container.appendChild(child);
}

function isNearCompletion(goal: GoalDefinition, runStats: RunStats): boolean {
  // v2: 只處理單一條件葉，複合條件回傳 false
  const completion = goal.completion;
  if (!('key' in completion) || !('operator' in completion) || !('value' in completion)) return false;
  if (completion.requiresVictory && !runStats.isVictory) return false;
  const current = (runStats as any)[completion.key] as number;
  const target = completion.value as number;
  switch (completion.operator) {
    case 'gte':
      return current < target && current >= target * 0.8;
    case 'lte':
      return current > target && current <= target * 1.2;
    case 'eq':
      return Math.abs(current - target) <= 1;
    default:
      return false;
  }
}

function describeProgress(goal: GoalDefinition, runStats: RunStats): string {
  // v2: 只處理單一條件葉，複合條件回傳預設訊息
  const completion = goal.completion;
  if (!('key' in completion) || !('operator' in completion) || !('value' in completion)) {
    return '完成所有條件以達成目標。';
  }
  if (completion.requiresVictory && !runStats.isVictory) {
    return '此目標需完成最終波次後才會計入。';
  }

  const current = (runStats as any)[completion.key] as number;
  const target = completion.value as number;
  const label = METRIC_LABEL[completion.key as keyof RunStats] ?? '進度';
  const displayCurrent = completion.key === 'clearTimeMinutes' ? current.toFixed(1) : current;
  const displayTarget = completion.key === 'clearTimeMinutes' ? target.toFixed(1) : target;
  const operator = completion.operator === 'lte' ? '需不超過' : '目標';
  return `${label} ${displayCurrent}／${operator} ${displayTarget}`;
}
