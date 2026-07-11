// ============================================================
// src/main.ts — 五行迷宮塔防 Entry Point
// ============================================================

import { gameState } from './state';
import { initDomRefs } from './domRefs';
import { loadTalentData } from './talent';
import { initSprites } from './sprites';
import { GAME_VERSION } from './types';
import releaseNotesText from '../Releasenote.md?raw';
import { initBgmUnlocker, playSFX, setupMusicToggle } from './audio/audioSystem';

// 引入子模組，觸發其註冊 callback 的副作用
import { switchScene, refreshMenuTalentInfo } from './scenes/scenesManager';
import { initMapEditorEvents } from './scenes/mapEditor';
import { updatePhysics } from './battle/physics';
import { renderGame, loadAllHighResSprites } from './renderer/gameRenderer';
import { initInputEvents } from './input/inputHandler';

import './battle/battleManager';
import './battle/towerActions';
import './ui/uiManager';

// 初始化 DOM 參考
initDomRefs();

import { updateMergeAnimation } from './battle/towerActions';

// 主遊戲循環
function gameLoop() {
  if (gameState.currentScene === 'BATTLE') {
    if (gameState.mergeAnimation && gameState.mergeAnimation.active) {
      const currentTimer = gameState.mergeAnimation.timer;
      updateMergeAnimation();
      // 慢動作：合成期間每 8 幀執行一次物理計算 (0.125x)
      if (currentTimer % 8 === 0) {
        updatePhysics();
      }
      renderGame();
    } else if (gameState.hitStopFrames > 0) {
      gameState.hitStopFrames--;
      renderGame();
    } else {
      const speed = gameState.gameSpeed || 1;
      for (let i = 0; i < speed; i++) {
        updatePhysics();
      }
      renderGame();
    }
  }
  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

// 註冊遊戲循環 callback 到 gameState
(gameState as any).gameLoop = gameLoop;

// 初始化版本顯示與更新日誌
function initVersionAndReleaseNotes() {
  const versionEl = document.getElementById('gameVersion');
  if (versionEl) {
    versionEl.textContent = GAME_VERSION;
  }
  
  const btnReleaseNotes = document.getElementById('btnReleaseNotes');
  const releaseNotesModal = document.getElementById('releaseNotesModal');
  const btnCloseReleaseNotes = document.getElementById('btnCloseReleaseNotes');
  const releaseNotesBody = document.getElementById('releaseNotesBody');
  
  if (btnReleaseNotes && releaseNotesModal && releaseNotesBody) {
    btnReleaseNotes.addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      
      // 將 Markdown 格式簡易轉為 HTML (支援標題、清單、粗體、換行)
      const html = releaseNotesText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^# (.*$)/gim, '<h2 style="font-size: 1.4rem; color: var(--gold); margin-top: 16px; margin-bottom: 8px; font-weight:700;">$1</h2>')
        .replace(/^## (.*$)/gim, '<h3 style="font-size: 1.15rem; color: #a5b4fc; margin-top: 14px; margin-bottom: 6px; font-weight:700; border-bottom:1px dashed var(--border-color); padding-bottom:4px;">$1</h3>')
        .replace(/^### (.*$)/gim, '<h4 style="font-size: 1rem; color: var(--text-color); margin-top: 8px; margin-bottom: 4px; font-weight:700;">$1</h4>')
        .replace(/^\s*-\s*(.*$)/gim, '<li style="margin-left: 16px; margin-bottom: 6px; list-style-type: disc;">$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold);">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      
      releaseNotesBody.innerHTML = html;
      releaseNotesModal.style.display = 'flex';
    });
  }
  
  if (btnCloseReleaseNotes && releaseNotesModal) {
    btnCloseReleaseNotes.addEventListener('click', (e) => {
      e.stopPropagation();
      playSFX('click');
      releaseNotesModal.style.display = 'none';
    });
  }
}

// 啟動初始化
gameState.talentData = loadTalentData();
initSprites();
loadAllHighResSprites();
initMapEditorEvents();
initInputEvents();
refreshMenuTalentInfo();
initBgmUnlocker();
setupMusicToggle();
initVersionAndReleaseNotes();

// 預設切換到主選單場景
switchScene('MAIN_MENU');
