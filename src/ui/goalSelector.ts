// ============================================================
// src/ui/goalSelector.ts — 天賦頁：「下次目標」勾選區 + 紀錄板 tab
// ============================================================
//
// 由 scenesManager.switchScene('TALENT_SCREEN') 進場後呼叫 renderGoalSelector()。
// 在 #talentScreen 內動態插入 `.goal-panel`，掛在 #btnBackFromTalent 上方。
//
// panel 結構：
//   .goal-panel
//     .goal-panel-tabs
//       button[data-tab="select"]  下次目標
//       button[data-tab="board"]   紀錄板
//     .goal-panel-body
//       .goal-tab-select  — 8 目標卡片 + 解鎖狀態 + completed 標記
//       .goal-tab-board   — 由 goalBoard.renderGoalBoard 渲染
//
// 勾選行為：呼叫 selectGoal(data, goalId) + saveTalentData(data)。
// 已完成目標仍可再選（不阻擋）；只檢查 unlock 條件，未解鎖卡片顯示鎖定並 disabled。
//
// F3：requiresVictory 目標卡片不顯示 bestWave 欄位（留給紀錄板處理）。

import { gameState } from '../state';
import { saveTalentData } from '../talent';
import { getAllGoals, getGoalConfigVersion } from '../goals/config';
import { isGoalCompleted, isGoalUnlocked, selectGoal } from '../goals/state';
import { renderGoalBoard } from './goalBoard';
import { getGoalIconMarkup } from './goalIcons';

const PANEL_ID = 'goal-panel-v1';

/** 當前目標面板所處分頁狀態（模組級 record，跨 render 共用） */
let activeTab: 'select' | 'board' = 'select';

/**
 * 渲染（或重渲染）天賦頁目標面板。
 * 重複呼叫安全：會清掉舊 panel 並重建。
 */
export function renderGoalSelector(): void {
  if (typeof document === 'undefined') return;
  const talentScreen = document.getElementById('talentScreen');
  if (!talentScreen) return;

  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'goal-panel';

  const tabs = document.createElement('div');
  tabs.className = 'goal-panel-tabs';
  const tabSelect = document.createElement('button');
  tabSelect.type = 'button';
  tabSelect.className = 'goal-tab';
  tabSelect.dataset.tab = 'select';
  tabSelect.textContent = '下次目標';
  const tabBoard = document.createElement('button');
  tabBoard.type = 'button';
  tabBoard.className = 'goal-tab';
  tabBoard.dataset.tab = 'board';
  tabBoard.textContent = '紀錄板';
  tabs.append(tabSelect, tabBoard);

  const body = document.createElement('div');
  body.className = 'goal-panel-body';
  panel.append(tabs, body);

  // 插到 btnBackFromTalent 上方
  const backBtn = document.getElementById('btnBackFromTalent');
  if (backBtn && backBtn.parentNode) {
    backBtn.parentNode.insertBefore(panel, backBtn);
  } else {
    talentScreen.appendChild(panel);
  }

  const renderTab = (tab: 'select' | 'board'): void => {
    activeTab = tab;
    tabSelect.classList.toggle('active', tab === 'select');
    tabBoard.classList.toggle('active', tab === 'board');
    if (tab === 'select') {
      renderSelectTab(body);
    } else {
      renderGoalBoard(body, gameState.talentData);
    }
  };

  tabSelect.addEventListener('click', () => renderTab('select'));
  tabBoard.addEventListener('click', () => renderTab('board'));

  renderTab(activeTab);
}

/** 渲染「下次目標」分頁 */
function renderSelectTab(container: HTMLElement): void {
  const data = gameState.talentData;
  const currentGoalId = data.nextGoalId ?? null;
  const ascensionLevel = gameState.ascensionLevel ?? 0;
  // F10：改用正式通關次數計數器
  const runsCompleted = data.formalRunsCompleted ?? 0;

  const header = document.createElement('div');
  header.className = 'goal-select-header';
  header.innerHTML = `
    <div class="goal-select-title">下次目標</div>
    <div class="goal-select-hint">勾選一個目標作為下次開局的挑戰；可隨時更改，無懲罰。</div>
  `;
  container.innerHTML = '';
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'goal-card-grid';

  for (const goal of getAllGoals()) {
    const unlocked = isGoalUnlocked(goal, ascensionLevel, runsCompleted);
    const completed = isGoalCompleted(data, goal.id);
    const selected = currentGoalId === goal.id;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'goal-card';
    if (selected) card.classList.add('goal-card-selected');
    if (completed) card.classList.add('goal-card-completed');
    if (!unlocked) card.classList.add('goal-card-locked');
    card.disabled = !unlocked;
    card.dataset.goalId = goal.id;

    const unlockNote = unlocked ? '' : renderUnlockNote(goal.unlock, ascensionLevel, runsCompleted);
    const completedTag = completed ? '<span class="goal-card-tag">✓ 已達成</span>' : '';
    const selectedTag = selected ? '<span class="goal-card-current">目前選擇</span>' : '';

    card.innerHTML = `
      <div class="goal-card-head">
        <span class="goal-card-seal" aria-hidden="true">${getGoalIconMarkup(goal.id)}</span>
        <span class="goal-card-copy">
          <span class="goal-card-label">${goal.label}</span>
          <span class="goal-card-category">${goal.category}</span>
        </span>
        <span class="goal-card-state">
          ${selectedTag}
          ${completedTag}
        </span>
      </div>
      <div class="goal-card-desc">${goal.description}</div>
      ${unlockNote}
    `;

    if (unlocked) {
      card.addEventListener('click', () => {
        const newId = selected ? null : goal.id;
        selectGoal(data, newId);
        saveTalentData(data);
        renderSelectTab(container);
      });
    }

    grid.appendChild(card);
  }

  container.appendChild(grid);

  // 版本戳顯示（設計除錯用，未來可移除）
  const footer = document.createElement('div');
  footer.className = 'goal-select-footer';
  footer.textContent = `目標清單版本：${getGoalConfigVersion()}`;
  container.appendChild(footer);
}

function renderUnlockNote(
  unlock: { minAscension?: number; minRunsCompleted?: number } | undefined,
  ascensionLevel: number,
  runsCompleted: number,
): string {
  if (!unlock) return '';
  const parts: string[] = [];
  if (unlock.minAscension !== undefined) {
    parts.push(`Ascension ${unlock.minAscension}+ (目前 ${ascensionLevel})`);
  }
  if (unlock.minRunsCompleted !== undefined) {
    parts.push(`通關 ${unlock.minRunsCompleted} 局+ (目前 ${runsCompleted})`);
  }
  if (parts.length === 0) return '';
  return `<div class="goal-card-locked-note">🔒 尚未解鎖：${parts.join('、')}</div>`;
}

/** 提供外部於結算後強制刷新面板用（例如玩家在天賦頁切回時） */
export function refreshGoalSelectorIfPresent(): void {
  if (document.getElementById(PANEL_ID)) {
    renderGoalSelector();
  }
}
