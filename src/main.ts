// ============================================================
// src/main.ts — 五行迷宮塔防 核心遊戲邏輯
// ============================================================

import { BASE_TOWERS, getTowerDef, getSameMergeResult, getCrossRecipeResult, getElementBonus, getSellPrice, type TowerTypeId } from './towers';
import { ENEMY_DEFS, getWaveConfig, type EnemyTypeId } from './enemies';
import { loadTalentData, getAvailablePoints, canUnlockTalent, unlockTalent, calcTalentPointsEarned, addTalentPoints, getBaseHP, getStartGold, getDamageMultiplier, getTowerElementDamageMultiplier, getFireRateMultiplier, isTowerUnlocked, resetTalents, TALENT_TREE, getWallCost, type TalentId } from './talent';
import { initSprites, drawEnemySprite, drawTowerSprite, preloadImage, drawTile, spriteCache } from './sprites';
import { MAPS, loadCustomMaps, saveCustomMaps, deleteCustomMap, type MapConfig } from './maps';
import type { Point, Enemy, Tower, GameScene, EditorTool, ThemeId, WeatherId } from './types';
import { GAME_VERSION, MAX_WAVES } from './types';
import releaseNotesText from '../Releasenote.md?raw';
import { initBgmUnlocker, playSFX, setupMusicToggle } from './audio/audioSystem';
import { createSplatterParticles, createHitParticles, createDeathParticles, createMergeParticles, updateParticles } from './renderer/particles';
import { drawObstacle } from './renderer/drawObstacle';
import { drawRoutePreview } from './renderer/drawRoutePreview';
import { astarFind, recalculatePathTiles, validatePlacement, updateAllEnemyPaths } from './battle/pathfinding';
import { gameState } from './state';
import { initDomRefs, getDomRefs } from './domRefs';

// 純常數，不屬於可變狀態
const dragThreshold = 5;
initDomRefs();

// ============================================================
// 1. 場景切換
// ============================================================

function switchScene(scene: GameScene) {
  gameState.currentScene = scene;
  getDomRefs().mainMenuEl.classList.remove('active');
  getDomRefs().levelSelectScreenEl.classList.remove('active');
  getDomRefs().mapEditorSceneEl.classList.remove('active');
  getDomRefs().talentScreenEl.classList.remove('active');
  getDomRefs().gameOverScreenEl.classList.remove('active');
  getDomRefs().battleSceneEl.classList.remove('active');

  // 離開編輯器時停止其渲染迴圈
  if (scene !== 'MAP_EDITOR' && gameState.editorAnimId) {
    cancelAnimationFrame(gameState.editorAnimId);
    gameState.editorAnimId = null;
  }

  switch (scene) {
    case 'MAIN_MENU':
      getDomRefs().mainMenuEl.classList.add('active');
      if (gameState.animFrameId) { cancelAnimationFrame(gameState.animFrameId); gameState.animFrameId = null; }
      refreshMenuTalentInfo();
      break;
    case 'LEVEL_SELECT':
      getDomRefs().levelSelectScreenEl.classList.add('active');
      renderLevelSelectScreen();
      break;
    case 'MAP_EDITOR':
      getDomRefs().mapEditorSceneEl.classList.add('active');
      initEditor();
      break;
    case 'TALENT_SCREEN':
      getDomRefs().talentScreenEl.classList.add('active');
      renderTalentScreen();
      break;
    case 'BATTLE':
      getDomRefs().battleSceneEl.classList.add('active');
      startBattle();
      if (gameState.currentMap && gameState.currentMap.id === 'test_level') {
        gameState.mapScale = 1.0;
        gameState.mapOffsetX = 0;
        gameState.mapOffsetY = 0;
      } else {
        gameState.mapScale = 2.0; // 2x zoom for large maps
        gameState.mapOffsetX = 0; // Align left
        gameState.mapOffsetY = -320; // Center Y-axis vertically
      }
      resizeGameContainer();
      break;
    case 'GAME_OVER':
      getDomRefs().gameOverScreenEl.classList.add('active');
      if (gameState.animFrameId) { cancelAnimationFrame(gameState.animFrameId); gameState.animFrameId = null; }
      break;
  }
}

function refreshMenuTalentInfo() {
  const info = document.getElementById('menuTalentInfo')!;
  const pts = getAvailablePoints(gameState.talentData);
  const total = gameState.talentData.totalTalentPoints;
  info.textContent = total > 0 ? `🌟 天賦點: ${pts} 可用 / ${total} 總計` : '尚未獲得天賦點';
}

function renderLevelSelectScreen() {
  getDomRefs().levelGridEl.innerHTML = '';
  const allMaps = [...MAPS, ...loadCustomMaps()];
  allMaps.forEach(map => {
    const card = document.createElement('div');
    card.className = 'level-card';
    
    let badgeClass = 'badge-easy';
    if (map.difficulty === '教學') badgeClass = 'badge-tutorial';
    else if (map.difficulty === '中等') badgeClass = 'badge-normal';
    else if (map.difficulty === '困難') badgeClass = 'badge-hard';
    else if (map.difficulty === '自訂') badgeClass = 'badge-custom';
    else if (map.difficulty === '測試') badgeClass = 'badge-test';
    
    const isCustom = map.difficulty === '自訂';
    card.innerHTML = `
      <span class="level-badge ${badgeClass}">${map.difficulty}</span>
      <div class="level-title">${map.name}</div>
      <div class="level-desc">${map.description}</div>
      <div class="level-info">
        📍 起點: (${map.spawnPoint.x}, ${map.spawnPoint.y}) &nbsp;&nbsp; 
        🏠 終點: (${map.basePoint.x}, ${map.basePoint.y}) <br>
        🏁 檢查點: ${map.waypoints.length} 個 &nbsp;&nbsp;
        ⛰️ 障礙物: ${map.obstacles.length} 個
      </div>
      ${isCustom ? '<div class="level-card-actions"><button class="btn-delete" data-delete-map="' + map.id + '">🗑️ 刪除</button></div>' : ''}
    `;
    
    card.addEventListener('click', (e) => {
      // 防止點擊刪除按鈕時觸發卡片點擊
      if ((e.target as HTMLElement).hasAttribute('data-delete-map')) return;
      playSFX('click');
      gameState.currentMap = map;
      switchScene('BATTLE');
    });

    // 自訂地圖的刪除按鈕
    if (isCustom) {
      const delBtn = card.querySelector('.btn-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`確定要刪除自訂地圖「${map.name}」嗎？`)) {
            deleteCustomMap(map.id);
            renderLevelSelectScreen(); // 重新渲染列表
          }
        });
      }
    }
    
    getDomRefs().levelGridEl.appendChild(card);
  });
}

// ============================================================
// 1.5 地圖編輯器
// ============================================================

function initEditor() {
  gameState.editorGrid = Array.from({ length: gameState.COLS }, () => Array(gameState.ROWS).fill(0));
  gameState.editorSpawn = null;
  gameState.editorBase = null;
  gameState.editorWaypoints = [];
  gameState.editorTool = 'obstacle';
  getDomRefs().editorMapNameInput.value = '';
  gameState.editorMouseDown = false;
  
  // 重設工具按鈕高亮
  document.querySelectorAll('[data-editor-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-editor-tool') === 'obstacle');
  });
  
  updateEditorStatus();
  startEditorLoop();
}

function startEditorLoop() {
  if (gameState.editorAnimId) cancelAnimationFrame(gameState.editorAnimId);
  function loop() {
    if (gameState.currentScene !== 'MAP_EDITOR') return;
    renderEditor();
    gameState.editorAnimId = requestAnimationFrame(loop);
  }
  gameState.editorAnimId = requestAnimationFrame(loop);
}

function renderEditor() {
  const ctx = getDomRefs().editorCtx;
  const W = getDomRefs().editorCanvasEl.width;
  const H = getDomRefs().editorCanvasEl.height;
  
  // 背景
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, W, H);

  // 網格線
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= gameState.COLS; x++) { ctx.beginPath(); ctx.moveTo(x * gameState.TILE_SIZE, 0); ctx.lineTo(x * gameState.TILE_SIZE, gameState.ROWS * gameState.TILE_SIZE); ctx.stroke(); }
  for (let y = 0; y <= gameState.ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * gameState.TILE_SIZE); ctx.lineTo(gameState.COLS * gameState.TILE_SIZE, y * gameState.TILE_SIZE); ctx.stroke(); }

  // 障礙物
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      if (gameState.editorGrid[x][y] === 2) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x * gameState.TILE_SIZE + 2, y * gameState.TILE_SIZE + 2, gameState.TILE_SIZE - 4, gameState.TILE_SIZE - 4);
        ctx.strokeRect(x * gameState.TILE_SIZE + 2, y * gameState.TILE_SIZE + 2, gameState.TILE_SIZE - 4, gameState.TILE_SIZE - 4);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(x * gameState.TILE_SIZE + 6, y * gameState.TILE_SIZE + 6, gameState.TILE_SIZE - 12, gameState.TILE_SIZE - 12);
      }
    }
  }

  // 起點
  if (gameState.editorSpawn) {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(gameState.editorSpawn.x * gameState.TILE_SIZE, gameState.editorSpawn.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S', gameState.editorSpawn.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, gameState.editorSpawn.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2);
  }

  // 終點
  if (gameState.editorBase) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(gameState.editorBase.x * gameState.TILE_SIZE, gameState.editorBase.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('B', gameState.editorBase.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, gameState.editorBase.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2);
  }

  // 檢查點
  gameState.editorWaypoints.forEach((wp, idx) => {
    ctx.beginPath();
    ctx.arc(wp.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, wp.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((idx + 1).toString(), wp.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, wp.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2);
  });

  // 當前工具提示（左上角）
  const toolNames: Record<EditorTool, string> = {
    spawn: '📍 起點', base: '🏠 終點', waypoint: '🏁 檢查點',
    obstacle: '⛰️ 障礙物', eraser: '🧹 橡皮擦'
  };
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(4, 4, 130, 22);
  ctx.fillStyle = '#e2e8f0'; ctx.font = '12px Outfit, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`工具: ${toolNames[gameState.editorTool]}`, 10, 9);
}

function editorClickAt(gx: number, gy: number, isRightClick: boolean) {
  if (gx < 0 || gx >= gameState.COLS || gy < 0 || gy >= gameState.ROWS) return;

  if (isRightClick) {
    // 右鍵：在 waypoint 模式下刪除檢查點；在 obstacle 模式下擦除障礙物
    const wpIdx = gameState.editorWaypoints.findIndex(w => w.x === gx && w.y === gy);
    if (wpIdx !== -1) {
      gameState.editorWaypoints.splice(wpIdx, 1);
    } else if (gameState.editorGrid[gx][gy] === 2) {
      gameState.editorGrid[gx][gy] = 0;
    }
    updateEditorStatus();
    return;
  }

  // 左鍵操作
  switch (gameState.editorTool) {
    case 'spawn':
      // 清除舊起點格子
      if (gameState.editorSpawn && gameState.editorGrid[gameState.editorSpawn.x]?.[gameState.editorSpawn.y] === 2) {
        // 不清除障礙物
      }
      gameState.editorSpawn = { x: gx, y: gy };
      gameState.editorGrid[gx][gy] = 0; // 確保起點不在障礙上
      break;
    case 'base':
      gameState.editorBase = { x: gx, y: gy };
      gameState.editorGrid[gx][gy] = 0;
      break;
    case 'waypoint':
      // 不重複放置
      if (gameState.editorWaypoints.some(w => w.x === gx && w.y === gy)) break;
      if (gameState.editorWaypoints.length >= 8) break;
      gameState.editorGrid[gx][gy] = 0;
      gameState.editorWaypoints.push({ x: gx, y: gy });
      break;
    case 'obstacle':
      // 不覆蓋起終點和檢查點
      if (gameState.editorSpawn && gameState.editorSpawn.x === gx && gameState.editorSpawn.y === gy) break;
      if (gameState.editorBase && gameState.editorBase.x === gx && gameState.editorBase.y === gy) break;
      if (gameState.editorWaypoints.some(w => w.x === gx && w.y === gy)) break;
      gameState.editorGrid[gx][gy] = 2;
      break;
    case 'eraser':
      gameState.editorGrid[gx][gy] = 0;
      if (gameState.editorSpawn && gameState.editorSpawn.x === gx && gameState.editorSpawn.y === gy) gameState.editorSpawn = null;
      if (gameState.editorBase && gameState.editorBase.x === gx && gameState.editorBase.y === gy) gameState.editorBase = null;
      const ewIdx = gameState.editorWaypoints.findIndex(w => w.x === gx && w.y === gy);
      if (ewIdx !== -1) gameState.editorWaypoints.splice(ewIdx, 1);
      break;
  }
  updateEditorStatus();
}

function updateEditorStatus() {
  const parts: string[] = [];
  parts.push(gameState.editorSpawn ? `<span class="status-ok">📍 起點 ✔</span>` : `<span class="status-warn">📍 起點 ✘</span>`);
  parts.push(gameState.editorBase ? `<span class="status-ok">🏠 終點 ✔</span>` : `<span class="status-warn">🏠 終點 ✘</span>`);
  parts.push(gameState.editorWaypoints.length > 0
    ? `<span class="status-ok">🏁 檢查點: ${gameState.editorWaypoints.length} 個</span>`
    : `<span class="status-warn">🏁 檢查點: 0 個（至少 1 個）</span>`);
  
  let obsCnt = 0;
  for (let x = 0; x < gameState.COLS; x++) for (let y = 0; y < gameState.ROWS; y++) if (gameState.editorGrid[x]?.[y] === 2) obsCnt++;
  parts.push(`⛰️ 障礙物: ${obsCnt} 個`);
  getDomRefs().editorStatusEl.innerHTML = parts.join(' &nbsp;|&nbsp; ');
}

function editorValidatePath(): boolean {
  if (!gameState.editorSpawn || !gameState.editorBase || gameState.editorWaypoints.length === 0) return false;

  // 暫時將 gameState.grid 設為 gameState.editorGrid 的值來做 A* 驗證
  const backupGrid = gameState.grid.map(col => [...col]);
  for (let x = 0; x < gameState.COLS; x++) for (let y = 0; y < gameState.ROWS; y++) gameState.grid[x][y] = gameState.editorGrid[x]?.[y] || 0;
  
  let valid = true;
  let prev = gameState.editorSpawn;
  for (let i = 0; i <= gameState.editorWaypoints.length; i++) {
    const target = i === gameState.editorWaypoints.length ? gameState.editorBase : gameState.editorWaypoints[i];
    if (!astarFind(prev, target, gameState.grid, gameState.COLS, gameState.ROWS)) { valid = false; break; }
    prev = target;
  }

  // 還原 gameState.grid
  for (let x = 0; x < gameState.COLS; x++) for (let y = 0; y < gameState.ROWS; y++) gameState.grid[x][y] = backupGrid[x][y];
  return valid;
}

function editorSave() {
  const name = getDomRefs().editorMapNameInput.value.trim();
  if (!name) { alert('請輸入地圖名稱！'); return; }
  if (!gameState.editorSpawn) { alert('請設定起點！'); return; }
  if (!gameState.editorBase) { alert('請設定終點！'); return; }
  if (gameState.editorWaypoints.length === 0) { alert('請至少設定 1 個檢查點！'); return; }
  if (!editorValidatePath()) {
    alert('路徑驗證失敗！怪物無法從起點經過所有檢查點到達終點，請調整障礙物位置。');
    return;
  }

  const obstacles: { x: number; y: number }[] = [];
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      if (gameState.editorGrid[x]?.[y] === 2) obstacles.push({ x, y });
    }
  }

  const newMap: MapConfig = {
    id: `custom_${Date.now()}`,
    name,
    difficulty: '自訂',
    description: `玩家自建地圖：${gameState.editorWaypoints.length} 個檢查點、${obstacles.length} 個障礙物。`,
    spawnPoint: { ...gameState.editorSpawn },
    basePoint: { ...gameState.editorBase },
    waypoints: gameState.editorWaypoints.map(w => ({ ...w })),
    obstacles
  };

  const existing = loadCustomMaps();
  existing.push(newMap);
  saveCustomMaps(existing);
  alert(`地圖「${name}」已儲存！`);
  switchScene('LEVEL_SELECT');
}

// 編輯器 Canvas 事件綁定
getDomRefs().editorCanvasEl.addEventListener('mousedown', (e) => {
  if (gameState.currentScene !== 'MAP_EDITOR') return;
  e.preventDefault();
  gameState.editorMouseDown = true;
  const rect = getDomRefs().editorCanvasEl.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (getDomRefs().editorCanvasEl.width / rect.width);
  const clickY = (e.clientY - rect.top) * (getDomRefs().editorCanvasEl.height / rect.height);
  const gx = Math.floor(clickX / gameState.TILE_SIZE);
  const gy = Math.floor(clickY / gameState.TILE_SIZE);
  editorClickAt(gx, gy, e.button === 2);
});

getDomRefs().editorCanvasEl.addEventListener('mousemove', (e) => {
  if (gameState.currentScene !== 'MAP_EDITOR' || !gameState.editorMouseDown) return;
  if (gameState.editorTool !== 'obstacle' && gameState.editorTool !== 'eraser') return; // 只有障礙物和橡皮擦支持拖曳繪製
  const rect = getDomRefs().editorCanvasEl.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (getDomRefs().editorCanvasEl.width / rect.width);
  const clickY = (e.clientY - rect.top) * (getDomRefs().editorCanvasEl.height / rect.height);
  const gx = Math.floor(clickX / gameState.TILE_SIZE);
  const gy = Math.floor(clickY / gameState.TILE_SIZE);
  editorClickAt(gx, gy, false);
});

getDomRefs().editorCanvasEl.addEventListener('mouseup', () => { gameState.editorMouseDown = false; });
getDomRefs().editorCanvasEl.addEventListener('mouseleave', () => { gameState.editorMouseDown = false; });
getDomRefs().editorCanvasEl.addEventListener('contextmenu', (e) => { e.preventDefault(); });

// 編輯器工具列按鈕切換
document.querySelectorAll<HTMLButtonElement>('[data-editor-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.getAttribute('data-editor-tool') as EditorTool;
    if (!tool) return;
    gameState.editorTool = tool;
    document.querySelectorAll('[data-editor-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// 編輯器動作按鈕
document.getElementById('btnEditorValidate')!.addEventListener('click', () => {
  if (editorValidatePath()) {
    alert('✅ 路徑驗證通過！怪物可以從起點經所有檢查點抵達終點。');
  } else {
    alert('❌ 路徑驗證失敗！請確認起點、終點、檢查點都已設定，且路線暢通無阻。');
  }
});

document.getElementById('btnEditorClear')!.addEventListener('click', () => {
  if (confirm('確定要清空目前的編輯內容嗎？')) {
    initEditor();
  }
});

document.getElementById('btnEditorSave')!.addEventListener('click', () => { editorSave(); });
document.getElementById('btnBackFromEditor')!.addEventListener('click', () => { playSFX('click'); switchScene('LEVEL_SELECT'); });
document.getElementById('btnCreateMap')!.addEventListener('click', () => { playSFX('click'); switchScene('MAP_EDITOR'); });

// ============================================================
// 2. 天賦頁面渲染
// ============================================================

function renderTalentScreen() {
  document.getElementById('talentPointsVal')!.textContent = getAvailablePoints(gameState.talentData).toString();

  const cards = document.querySelectorAll('.talent-card');
  cards.forEach(cardEl => {
    const tid = cardEl.getAttribute('data-id') as TalentId;
    const node = TALENT_TREE.find(t => t.id === tid);
    if (!node) return;

    const level = gameState.talentData.talentLevels[tid] || 0;
    const isMax = level >= node.maxLevel;
    const canUpgrade = canUnlockTalent(gameState.talentData, tid);

    // 更新樣式類別
    cardEl.className = 'talent-card';
    if (level === 0) {
      if (canUpgrade) cardEl.classList.add('available');
      else cardEl.classList.add('locked');
    } else {
      cardEl.classList.add('unlocked');
      if (canUpgrade && !isMax) cardEl.classList.add('available');
    }

    // 根據天賦 ID 取得大圖示 emoji
    const emojiMap: Record<TalentId, string> = {
      fortress_1: '🛡️', fortress_2: '🏰',
      gold_1: '💰', gold_2: '🪙',
      precise_1: '🎯', precise_2: '⚔️', rapid_fire: '⚡',
      wood_awakening: '🌿', water_awakening: '💧', fire_awakening: '🔥',
      earth_awakening: '⛰️', metal_awakening: '⚔️',
      yin_law: '🌑', yang_law: '☀️', taiji_dao: '☯️',
      wall_discount: '🧱'
    };
    const emoji = emojiMap[tid] || '✨';

    // 計算未滿足的前置條件文字
    let prereqHtml = '';
    if (node.prerequisites.length > 0) {
      const unmetPrereqs = node.prerequisites.filter(
        pid => (gameState.talentData.talentLevels[pid] || 0) < 1
      );
      if (unmetPrereqs.length > 0) {
        const prereqNames = unmetPrereqs.map(pid => {
          const prereqNode = TALENT_TREE.find(t => t.id === pid);
          return prereqNode ? prereqNode.name : pid;
        });
        prereqHtml = `<div class="talent-card-prereq">🔒 需解鎖：${prereqNames.join('、')}</div>`;
      }
    }

    cardEl.innerHTML = `
      <div class="talent-icon">${emoji}</div>
      <div class="talent-card-info">
        <div class="talent-card-title">
          <span>${node.name}</span>
          <span class="talent-card-level">Lv.${level}/${node.maxLevel}</span>
        </div>
        <div class="talent-card-desc">${node.description}</div>
        ${prereqHtml}
        <div class="talent-card-cost">${isMax ? '✨ 已滿級' : `升級花費: ${node.cost} 點`}</div>
      </div>
    `;


    // 重設並重新綁定點擊事件
    const htmlEl = cardEl as HTMLElement;
    htmlEl.onclick = null;
    if (canUpgrade && !isMax) {
      htmlEl.onclick = () => {
        playSFX('click');
        unlockTalent(gameState.talentData, tid);
        renderTalentScreen();
      };
    }
  });

  // 更新所有箭頭的 active 狀態
  const arrows = document.querySelectorAll('.talent-arrow');
  arrows.forEach(arrowEl => {
    const fromId = arrowEl.getAttribute('data-from') as TalentId;
    const fromLvl = gameState.talentData.talentLevels[fromId] || 0;
    if (fromLvl >= 1) {
      arrowEl.classList.add('active');
    } else {
      arrowEl.classList.remove('active');
    }
  });
}

function initBgStars() {
  gameState.bgStars = [];
  const starCount = 80;
  for (let i = 0; i < starCount; i++) {
    gameState.bgStars.push({
      x: Math.random() * (gameState.COLS * gameState.TILE_SIZE),
      y: Math.random() * (gameState.ROWS * gameState.TILE_SIZE),
      size: 0.5 + Math.random() * 1.5,
      alpha: Math.random(),
      alphaSpeed: 0.005 + Math.random() * 0.015
    });
  }
}

// ============================================================
// 3. 戰鬥初始化
// ============================================================

function startBattle() {
  // 根據地圖動態決定網格大小與 gameState.TILE_SIZE
  if (gameState.currentMap.id === 'test_level') {
    gameState.COLS = 20;
    gameState.ROWS = 10;
    gameState.TILE_SIZE = 64;
  } else {
    gameState.COLS = 80;
    gameState.ROWS = 40;
    gameState.TILE_SIZE = 16;
  }

  // 重新分配 gameState.grid 大小
  gameState.grid = Array.from({ length: gameState.COLS }, () => Array(gameState.ROWS).fill(0));

  // 讀取地圖配置
  gameState.SPAWN_POINT = gameState.currentMap.spawnPoint;
  gameState.BASE_POINT = gameState.currentMap.basePoint;
  gameState.WAYPOINTS = gameState.currentMap.waypoints;

  // 讀取天賦效果
  gameState.hp = getBaseHP(gameState.talentData);
  gameState.gold = gameState.currentMap.id === 'test_level' ? 999999 : getStartGold(gameState.talentData);
  gameState.wave = 0;
  gameState.killCount = 0;
  gameState.isWaveActive = false;
  gameState.totalDamageDealt = 0;
  gameState.currentKillStreak = 0;
  gameState.maxKillStreak = 0;
  gameState.enemies = [];
  gameState.towers = [];
  gameState.bullets = [];
  gameState.floatingTexts = [];
  gameState.tempWalls = [];
  gameState.nextEnemyId = 1;
  gameState.nextTowerId = 1;
  gameState.mergeMode = false;
  gameState.mergeFirstTower = null;
  gameState.spawnTimers.forEach(t => clearInterval(t));
  gameState.spawnTimers = [];
  gameState.waveTotal = 0;
  gameState.waveSpawned = 0;

  // 清空網格並放置預設障礙物
  for (let x = 0; x < gameState.COLS; x++) for (let y = 0; y < gameState.ROWS; y++) gameState.grid[x][y] = 0;
  for (const obs of gameState.currentMap.obstacles) {
    if (obs.x >= 0 && obs.x < gameState.COLS && obs.y >= 0 && obs.y < gameState.ROWS) {
      gameState.grid[obs.x][obs.y] = 2; // 2 代表天然地形障礙物
    }
  }

  // 初始化星空背景與天氣粒子
  initBgStars();
  gameState.weatherParticles = [];
  gameState.lightningActive = 0;
  gameState.currentTheme = (getDomRefs().selectTheme.value as ThemeId) || 'scifi';
  gameState.currentWeather = (getDomRefs().selectWeather.value as WeatherId) || 'none';

  // 動態生成砲台按鈕
  buildTowerButtons();
  gameState.selectedTool = 'earth';
  refreshToolSelection();
  updateUI();

  // 啟動遊戲迴圈
  if (gameState.animFrameId) cancelAnimationFrame(gameState.animFrameId);
  recalculatePathTiles(gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, cachedPathTiles, cachedFullPath);
  gameLoop();
}

function buildTowerButtons() {
  getDomRefs().towerButtonsContainer.innerHTML = '';
  const towerIds: TowerTypeId[] = ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'];

  for (const tid of towerIds) {
    const def = BASE_TOWERS[tid];
    if (!def) continue;
    const unlocked = gameState.currentMap.id === 'test_level' ? true : isTowerUnlocked(gameState.talentData, tid);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.setAttribute('data-tool', tid);
    btn.disabled = !unlocked;
    const cost = tid === 'earth' ? getWallCost(gameState.talentData) : def.cost;
    btn.textContent = `${def.emoji} ${def.name} (${cost}g)`;
    if (!unlocked && gameState.currentMap.id !== 'test_level') btn.title = '需先在天賦頁解鎖';
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      gameState.mergeMode = false;
      gameState.mergeFirstTower = null;
      gameState.selectedTool = tid;
      refreshToolSelection();
    });
    getDomRefs().towerButtonsContainer.appendChild(btn);
  }
}

function refreshToolSelection() {
  const allBtns = getDomRefs().towerButtonsContainer.querySelectorAll('.btn');
  allBtns.forEach(b => b.classList.remove('active'));
  const activeBtn = getDomRefs().towerButtonsContainer.querySelector(`[data-tool="${gameState.selectedTool}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  getDomRefs().btnMerge.classList.toggle('active', gameState.mergeMode);
  getDomRefs().btnSell.classList.toggle('active', gameState.selectedTool === 'sell');

  if (gameState.mergeMode) {
    getDomRefs().instructionText.innerHTML = '<span class="merge-hint">🔮 合成模式：點擊一座塔選為材料，再點擊相鄰的塔進行合成</span>';
  } else if (gameState.selectedTool === 'sell') {
    getDomRefs().instructionText.textContent = '💰 拆除模式：點擊砲台將其拆除並退回部分金幣';
  } else {
    if (gameState.currentMap && gameState.currentMap.id === 'tutorial') {
      getDomRefs().instructionText.innerHTML = '🎓 <span style="color:#fbbf24; font-weight:bold;">教學引導：</span>因橫向長牆阻擋，怪物必須先向右繞過 3 號點入口才進入 1 號點。推薦在右側瓶頸 <span style="color:#38bdf8; font-weight:bold;">(58, 17)</span> 建造攻擊塔，讓怪物在三個尋路階段反覆受擊！';
    } else {
      getDomRefs().instructionText.innerHTML = '選擇砲台後點擊地圖擺放。怪物依序碰觸 <span style="color:#f59e0b">❶❷❸❹❺</span> 檢查點再抵達基地。用砲台築迷宮！';
    }
  }
}

// ============================================================
// 4. A* 尋路
// ============================================================

let cachedPathTiles = new Set<string>();
let cachedFullPath: Point[] = [];

// ============================================================
// 5. 砲台放置 / 拆除 / 合成
// ============================================================

getDomRefs().canvas.addEventListener('click', (e) => {
  if (gameState.currentScene !== 'BATTLE') return;

  // 如果剛剛是拖曳地圖，則這次點擊不觸發放置或售塔
  if (gameState.isDraggingMap) {
    gameState.isDraggingMap = false;
    return;
  }

  const rect = getDomRefs().canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (getDomRefs().canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (getDomRefs().canvas.height / rect.height);

  // 反向換算地圖平移與縮放後的座標
  const worldX = (clickX - gameState.mapOffsetX) / gameState.mapScale;
  const worldY = (clickY - gameState.mapOffsetY) / gameState.mapScale;

  const gx = Math.max(0, Math.min(gameState.COLS - 1, Math.floor(worldX / gameState.TILE_SIZE)));
  const gy = Math.max(0, Math.min(gameState.ROWS - 1, Math.floor(worldY / gameState.TILE_SIZE)));

  if (gameState.mergeMode) {
    handleMergeClick(gx, gy);
    return;
  }

  if (gameState.selectedTool === 'sell') {
    handleSell(gx, gy);
    return;
  }

  // 放置砲台
  handleBuild(gx, gy);
});

// 右鍵快速售塔
getDomRefs().canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (gameState.currentScene !== 'BATTLE') return;
  
  const rect = getDomRefs().canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (getDomRefs().canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (getDomRefs().canvas.height / rect.height);

  const worldX = (clickX - gameState.mapOffsetX) / gameState.mapScale;
  const worldY = (clickY - gameState.mapOffsetY) / gameState.mapScale;

  const gx = Math.max(0, Math.min(gameState.COLS - 1, Math.floor(worldX / gameState.TILE_SIZE)));
  const gy = Math.max(0, Math.min(gameState.ROWS - 1, Math.floor(worldY / gameState.TILE_SIZE)));
  handleSell(gx, gy);
});

function handleBuild(x: number, y: number) {
  if (gameState.grid[x][y] !== 0) { showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '已有建物', '#ef4444', 15); return; }
  const def = BASE_TOWERS[gameState.selectedTool];
  if (!def) return;
  const cost = gameState.selectedTool === 'earth' ? getWallCost(gameState.talentData) : def.cost;
  if (gameState.gold < cost) { showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '金幣不足', '#ef4444', 15); return; }

  if (def.isWall && !validatePlacement(x, y, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.enemies)) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '不能堵死怪物！', '#ef4444', 15);
    return;
  }

  gameState.grid[x][y] = def.isWall ? 1 : 0;
  gameState.towers.push({ id: gameState.nextTowerId++, x, y, typeId: def.id, def: { ...def, cost }, cooldown: 0, recoilY: 0 });
  if (gameState.currentMap.id !== 'test_level') gameState.gold -= cost;
  updateUI();
  if (def.isWall) updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, cachedPathTiles, cachedFullPath);
}

function handleSell(x: number, y: number) {
  if (gameState.grid[x][y] === 2) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '天然障礙物無法拆除', '#ef4444', 15);
    return;
  }
  const idx = gameState.towers.findIndex(t => t.x === x && t.y === y);
  if (idx === -1) return;
  const tower = gameState.towers[idx];
  const refund = getSellPrice(tower.def);
  gameState.gold += refund;
  gameState.towers.splice(idx, 1);
  gameState.grid[x][y] = 0;
  if (gameState.mergeFirstTower && gameState.mergeFirstTower.id === tower.id) gameState.mergeFirstTower = null;
  // 清理以死亡/無效敵人為目標的子彈，避免懸空參照
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const t = gameState.bullets[i].targetEnemy;
    if (!t || t.hp <= 0 || !gameState.enemies.some(e => e.id === t.id)) gameState.bullets.splice(i, 1);
  }
  updateUI();
  updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, cachedPathTiles, cachedFullPath);
  showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, `+${refund}g`, '#f59e0b');
}

function handleMergeClick(x: number, y: number) {
  const clickedTower = gameState.towers.find(t => t.x === x && t.y === y);
  if (!clickedTower) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '沒有砲台', '#ef4444', 15);
    return;
  }

  if (!gameState.mergeFirstTower) {
    // 選擇第一座塔
    gameState.mergeFirstTower = clickedTower;
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '已選取，請點擊另一座塔合成', '#c084fc', 15);
    return;
  }

  // 選擇第二座塔 — 檢查是否為同一座塔（取消選取）
  if (clickedTower.id === gameState.mergeFirstTower.id) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '已取消選取', '#94a3b8', 15);
    gameState.mergeFirstTower = null;
    return;
  }

  // 同系合成
  if (clickedTower.def.element === gameState.mergeFirstTower.def.element &&
      clickedTower.def.level === 1 && gameState.mergeFirstTower.def.level === 1) {
    const resultId = getSameMergeResult(clickedTower.def.element);
    if (resultId) {
      performMerge(gameState.mergeFirstTower, clickedTower, resultId);
      gameState.mergeFirstTower = null;
      return;
    }
  }

  // 異系配方合成
  const el1 = gameState.mergeFirstTower.def.element;
  const el2 = clickedTower.def.element;
  const recipeResult = getCrossRecipeResult(el1, el2);
  if (recipeResult) {
    // 陰陽合成需天賦（測試關卡除外）
    if ((el1 === 'yin' || el1 === 'yang') && (el2 === 'yin' || el2 === 'yang')) {
      if (gameState.currentMap.id !== 'test_level' && (gameState.talentData.talentLevels['taiji_dao'] || 0) < 1) {
        showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '需解鎖「太極之道」天賦', '#ef4444', 15);
        gameState.mergeFirstTower = null;
        return;
      }
    }
    performMerge(gameState.mergeFirstTower, clickedTower, recipeResult);
    gameState.mergeFirstTower = null;
    return;
  }

  showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '無法合成此組合', '#ef4444', 15);
  gameState.mergeFirstTower = null;
}

function performMerge(tower1: Tower, tower2: Tower, resultId: TowerTypeId) {
  const resultDef = getTowerDef(resultId);
  if (!resultDef) return;

  // 移除第二座塔
  const idx2 = gameState.towers.findIndex(t => t.id === tower2.id);
  if (idx2 !== -1) { gameState.towers.splice(idx2, 1); gameState.grid[tower2.x][tower2.y] = 0; }
  if (gameState.mergeFirstTower && gameState.mergeFirstTower.id === tower2.id) gameState.mergeFirstTower = null;

  // 升級第一座塔
  tower1.typeId = resultId;
  tower1.def = { ...resultDef };
  tower1.cooldown = 0;

  // 清理以死亡/無效敵人為目標的子彈，避免懸空參照
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const t = gameState.bullets[i].targetEnemy;
    if (!t || t.hp <= 0 || !gameState.enemies.some(e => e.id === t.id)) gameState.bullets.splice(i, 1);
  }

  updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, cachedPathTiles, cachedFullPath);
  showFloat(tower1.x * gameState.TILE_SIZE + 8, tower1.y * gameState.TILE_SIZE, `✨ ${resultDef.name}`, '#c084fc', 16);
  createMergeParticles(gameState.particles, gameState.TILE_SIZE, tower1.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, tower1.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2);
  playSFX('merge_success');
}

// ============================================================
// 6. 波次系統
// ============================================================

getDomRefs().btnStartWave.addEventListener('click', () => {
  if (gameState.isWaveActive || gameState.currentScene !== 'BATTLE') return;
  playSFX('click');
  gameState.wave++;
  gameState.isWaveActive = true;
  updateUI();
  spawnWave(gameState.wave);
});

function spawnWave(waveNum: number) {
  const configs = getWaveConfig(waveNum);
  gameState.waveTotal = 0;
  gameState.waveSpawned = 0;

  for (const cfg of configs) gameState.waveTotal += cfg.count;

  for (const cfg of configs) {
    let spawned = 0;
    const timer = setInterval(() => {
      if (spawned >= cfg.count) { clearInterval(timer); return; }
      const def = ENEMY_DEFS[cfg.enemyType];
      const startPos = { ...gameState.SPAWN_POINT };
      const path = astarFind(startPos, gameState.WAYPOINTS[0], gameState.grid, gameState.COLS, gameState.ROWS, def.isFlying);
      const isStuck = !path;
      gameState.enemies.push({
        id: gameState.nextEnemyId++,
        type: cfg.enemyType,
        element: def.element,
        x: startPos.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
        y: startPos.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
        currentGridX: startPos.x, currentGridY: startPos.y,
        hp: Math.floor(def.baseHp * cfg.hpMultiplier),
        maxHp: Math.floor(def.baseHp * cfg.hpMultiplier),
        speed: def.speed,
        baseSpeed: def.speed,
        goldAward: def.goldAward,
        isFlying: def.isFlying,
        waypointIndex: 0,
        path: path ?? [], pathIndex: 0,
        slowDuration: 0,
        dotDamage: 0, dotDuration: 0,
        hitFlashFrame: 0,
        vx: 0,
        vy: 0,
        squashX: 1,
        squashY: 1,
        isStuck,
        pathBlockedHintShown: isStuck
      });
      if (isStuck) {
        showFloat(startPos.x * gameState.TILE_SIZE + 8, startPos.y * gameState.TILE_SIZE, '道路被封死！', '#ef4444', 15);
      }
      spawned++;
      gameState.waveSpawned++;
    }, cfg.spawnIntervalMs);
    gameState.spawnTimers.push(timer);
  }
}

function spawnTestEnemy(enemyType: EnemyTypeId) {
  const def = ENEMY_DEFS[enemyType];
  if (!def) return;
  const startPos = { ...gameState.SPAWN_POINT };
  const path = astarFind(startPos, gameState.WAYPOINTS[0], gameState.grid, gameState.COLS, gameState.ROWS, def.isFlying);
  if (!path) {
    showFloat(startPos.x * gameState.TILE_SIZE + 8, startPos.y * gameState.TILE_SIZE, '起點路徑被堵死！', '#ef4444', 15);
    return;
  }

  // 強度計算：基於當前波次（如果波次為 0 則預設為 1）
  const curWave = gameState.wave || 1;
  const configs = getWaveConfig(curWave);
  const hpMult = configs[0] ? configs[0].hpMultiplier : 1.0;

  gameState.enemies.push({
    id: gameState.nextEnemyId++,
    type: enemyType,
    element: def.element,
    x: startPos.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
    y: startPos.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
    currentGridX: startPos.x, currentGridY: startPos.y,
    hp: Math.floor(def.baseHp * hpMult),
    maxHp: Math.floor(def.baseHp * hpMult),
    speed: def.speed,
    baseSpeed: def.speed,
    goldAward: def.goldAward,
    isFlying: def.isFlying,
    waypointIndex: 0,
    path, pathIndex: 0,
    slowDuration: 0,
    dotDamage: 0, dotDuration: 0,
    hitFlashFrame: 0,
    vx: 0,
    vy: 0,
    squashX: 1,
    squashY: 1
  });

  updateUI();
  showFloat(startPos.x * gameState.TILE_SIZE + 8, startPos.y * gameState.TILE_SIZE, `Spawned ${def.name}!`, '#8b5cf6', 14);
}

// ============================================================
// 7. 遊戲主迴圈
// ============================================================

function gameLoop() {
  if (gameState.currentScene !== 'BATTLE') return;
  updatePhysics();
  renderGame();
  gameState.animFrameId = requestAnimationFrame(gameLoop);
}

function updatePhysics() {
  const dmgMult = getDamageMultiplier(gameState.talentData);
  const frMult = getFireRateMultiplier(gameState.talentData);

  if (gameState.routePreviewTimer > 0) {
    gameState.routePreviewTimer--;
  }

  // 1. 怪物移動
  for (let i = gameState.enemies.length - 1; i >= 0; i--) {
    const e = gameState.enemies[i];

    // DOT 傷害
    if (e.dotDuration > 0) {
      e.hp -= e.dotDamage;
      gameState.totalDamageDealt += e.dotDamage;
      e.dotDuration--;
      if (e.hp <= 0) {
        gameState.gold += e.goldAward;
        gameState.killCount++;
        gameState.currentKillStreak++;
        if (gameState.currentKillStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.currentKillStreak;
        showFloat(e.x, e.y, `+${e.goldAward}g`, '#f59e0b');
        gameState.enemies.splice(i, 1);
        updateUI();
        checkWaveEnd();
        continue;
      }
    }

    // 遞減受擊高亮與形變恢復
    if (e.hitFlashFrame > 0) {
      e.hitFlashFrame--;
    }
    if (e.squashX === undefined) { e.squashX = 1; e.squashY = 1; }
    e.squashX += (1 - e.squashX) * 0.15;
    e.squashY += (1 - e.squashY) * 0.15;

    // 減速
    if (e.slowDuration > 0) { e.slowDuration--; e.speed = e.baseSpeed * 0.4; }
    else { e.speed = e.baseSpeed; }

    const prevX = e.x;
    const prevY = e.y;
    if (!e.isStuck && e.path && e.pathIndex < e.path.length) {
      const tg = e.path[e.pathIndex];
      const tx = tg.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const ty = tg.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const dx = tx - e.x, dy = ty - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= e.speed) {
        e.x = tx; e.y = ty;
        e.currentGridX = tg.x; e.currentGridY = tg.y;
        e.pathIndex++;

        const curTarget = e.waypointIndex >= gameState.WAYPOINTS.length ? gameState.BASE_POINT : gameState.WAYPOINTS[e.waypointIndex];
        if (e.currentGridX === curTarget.x && e.currentGridY === curTarget.y) {
          e.waypointIndex++;
          if (e.waypointIndex > gameState.WAYPOINTS.length) {
            if (gameState.currentMap.id !== 'test_level') {
              gameState.hp -= 1;
            }
            gameState.enemies.splice(i, 1);
            updateUI();
            if (gameState.currentMap.id !== 'test_level' && gameState.hp <= 0) { endBattle(false); return; }
            checkWaveEnd();
            continue;
          }
          const next = e.waypointIndex >= gameState.WAYPOINTS.length ? gameState.BASE_POINT : gameState.WAYPOINTS[e.waypointIndex];
          const np = astarFind({ x: e.currentGridX, y: e.currentGridY }, next, gameState.grid, gameState.COLS, gameState.ROWS, e.isFlying);
          if (np) {
            e.path = np; e.pathIndex = 0; e.isStuck = false;
          } else {
            e.isStuck = true;
            if (!e.pathBlockedHintShown) {
              showFloat(e.x, e.y - 16, '道路被封死！', '#ef4444', 14);
              e.pathBlockedHintShown = true;
            }
          }
        }
      } else {
        e.x += (dx / dist) * e.speed;
        e.y += (dy / dist) * e.speed;
      }
    }
    e.vx = e.x - prevX;
    e.vy = e.y - prevY;
  }

  // 2. 砲台射擊
  for (const tower of gameState.towers) {
    if (tower.recoilY === undefined) tower.recoilY = 0;
    tower.recoilY *= 0.82;
    if (tower.recoilY < 0.05) tower.recoilY = 0;

    if (tower.def.damage === 0 && !tower.def.buffAllyDmg) continue;

    // 鍛造塔 buff 效果（被動，不射擊）
    if (tower.def.buffAllyDmg) continue; // buff 在傷害計算時即時查詢

    if (tower.cooldown > 0) { tower.cooldown--; continue; }

    const tx = tower.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    const ty = tower.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    let best: Enemy | null = null;
    let minDist = Infinity;

    for (const e of gameState.enemies) {
      const d = Math.sqrt((e.x - tx) ** 2 + (e.y - ty) ** 2) / gameState.TILE_SIZE;
      if (d <= tower.def.range && d < minDist) { minDist = d; best = e; }
    }

    if (best) {
      // 計算傷害（含天賦倍率、五行屬性強化、鍛造塔 buff）
      let finalDmg = tower.def.damage * dmgMult * getTowerElementDamageMultiplier(gameState.talentData, tower.def.element);
      // 鍛造塔附近 buff 檢查
      for (const bt of gameState.towers) {
        if (!bt.def.buffAllyDmg) continue;
        const bdist = Math.abs(bt.x - tower.x) + Math.abs(bt.y - tower.y);
        if (bdist <= (bt.def.buffAllyRange ?? 2)) {
          finalDmg *= (1 + bt.def.buffAllyDmg);
        }
      }

      gameState.bullets.push({
        x: tx, y: ty,
        targetEnemy: best,
        speed: 6,
        damage: Math.floor(finalDmg),
        element: tower.def.element,
        slowPct: tower.def.slowPct,
        slowDuration: tower.def.slowDuration,
        dotDamage: tower.def.dotDamage,
        dotDuration: tower.def.dotDuration,
        aoeRadius: tower.def.aoeRadius,
        aoeDamagePct: tower.def.aoeDamagePct,
        hpPctDamage: tower.def.hpPctDamage,
        critChance: tower.def.critChance,
        critMultiplier: tower.def.critMultiplier,
        flyingBonus: tower.def.flyingBonus,
        healBase: tower.def.healBase,
        spawnWall: tower.def.spawnWall,
      });

      playSFX('shoot');

      tower.cooldown = Math.floor(tower.def.fireRate * frMult);
      tower.recoilY = 4.0;
    }
  }

  // 3. 子彈移動與擊中
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const b = gameState.bullets[i];
    const target = b.targetEnemy;
    const alive = target && target.hp > 0 && gameState.enemies.some(e => e.id === target.id);

    if (!alive) { gameState.bullets.splice(i, 1); continue; }

    const targetX = target.x;
    const targetY = target.y;
    const dx = targetX - b.x, dy = targetY - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= b.speed) {

      // 擊中處理
      let dmg = b.damage;

      // 五行相剋加成
      dmg = Math.floor(dmg * getElementBonus(b.element, b.targetEnemy.element));

      // 暴擊
      if (b.critChance && Math.random() < b.critChance) {
        dmg = Math.floor(dmg * (b.critMultiplier ?? 2));
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 14, '暴擊!', '#fde047');
      }

      // 飛行加成
      if (b.flyingBonus && b.targetEnemy.isFlying) {
        dmg = Math.floor(dmg * (1 + b.flyingBonus));
      }

      // % 血量傷害
      if (b.hpPctDamage) {
        dmg += Math.floor(b.targetEnemy.maxHp * b.hpPctDamage);
      }

      b.targetEnemy.hp -= dmg;
      gameState.totalDamageDealt += dmg;
      showFloat(b.targetEnemy.x, b.targetEnemy.y - 10, `-${dmg}`, '#ef4444');
      
      b.targetEnemy.hitFlashFrame = 6;
      b.targetEnemy.squashX = 1.35;
      b.targetEnemy.squashY = 0.65;

      // 產生屬性對應的擊中粒子
      const bulletColors: Record<string, string> = {
        fire: '#f97316', water: '#38bdf8', wood: '#4ade80',
        earth: '#d97706', metal: '#e5e7eb', yin: '#a855f7', yang: '#fde047'
      };
      const hitColor = bulletColors[b.element] ?? '#facc15';
      createHitParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, hitColor);
      createSplatterParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, hitColor, 4);

      // 減速效果
      if (b.slowPct && b.slowDuration) {
        b.targetEnemy.slowDuration = Math.max(b.targetEnemy.slowDuration, b.slowDuration);
      }

      // DOT 效果
      if (b.dotDamage && b.dotDuration) {
        b.targetEnemy.dotDamage = b.dotDamage;
        b.targetEnemy.dotDuration = Math.max(b.targetEnemy.dotDuration, b.dotDuration);
      }

      // AOE 傷害
      if (b.aoeRadius && b.aoeDamagePct) {
        const aoeDmg = Math.floor(dmg * b.aoeDamagePct);
        const aoeRange = b.aoeRadius * gameState.TILE_SIZE;
        for (const e of gameState.enemies) {
          if (e.id === b.targetEnemy.id) continue;
          const adist = Math.sqrt((e.x - b.targetEnemy.x) ** 2 + (e.y - b.targetEnemy.y) ** 2);
          if (adist <= aoeRange) {
            e.hp -= aoeDmg;
            gameState.totalDamageDealt += aoeDmg;
            showFloat(e.x, e.y - 10, `-${aoeDmg}`, '#f97316');
            
            e.hitFlashFrame = 6;
            e.squashX = 1.35;
            e.squashY = 0.65;
            createSplatterParticles(gameState.particles, gameState.TILE_SIZE, e.x, e.y, hitColor, 3);
          }
        }
      }

      // 治療基地
      if (b.healBase) {
        gameState.hp = Math.min(getBaseHP(gameState.talentData), gameState.hp + b.healBase);
      }

      // 靈木塔：生成臨時障礙（在怪物當前格，持續 5 秒）
      if (b.spawnWall) {
        const wx = b.targetEnemy.currentGridX;
        const wy = b.targetEnemy.currentGridY;
        const isFreeCell = gameState.grid[wx][wy] === 0 && !gameState.tempWalls.some(w => w.x === wx && w.y === wy);
        if (isFreeCell && validatePlacement(wx, wy, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.enemies)) {
          gameState.grid[wx][wy] = 1;
          gameState.tempWalls.push({ x: wx, y: wy, lifetime: 300 }); // 5秒 (300幀)
          updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, cachedPathTiles, cachedFullPath);
          showFloat(b.targetEnemy.x, b.targetEnemy.y - 16, '🌿 纏縛！', '#4ade80', 13);
        }
      }

      // 檢查目標死亡
      if (b.targetEnemy.hp <= 0) {
        const eidx = gameState.enemies.findIndex(e => e.id === b.targetEnemy.id);
        if (eidx !== -1) {
          gameState.gold += b.targetEnemy.goldAward;
          gameState.killCount++;
          gameState.currentKillStreak++;
          if (gameState.currentKillStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.currentKillStreak;
          showFloat(b.targetEnemy.x, b.targetEnemy.y, `+${b.targetEnemy.goldAward}g`, '#f59e0b');
          
          createDeathParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, hitColor);
          createSplatterParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, hitColor, 8);

          gameState.enemies.splice(eidx, 1);
          playSFX('enemy_death');
          updateUI();
          checkWaveEnd();
        }
      }

      // 檢查 AOE 造成的死亡
      for (let j = gameState.enemies.length - 1; j >= 0; j--) {
        if (gameState.enemies[j].hp <= 0) {
          gameState.gold += gameState.enemies[j].goldAward;
          gameState.killCount++;
          showFloat(gameState.enemies[j].x, gameState.enemies[j].y, `+${gameState.enemies[j].goldAward}g`, '#f59e0b');
          const pColor = ENEMY_DEFS[gameState.enemies[j].type]?.colorPrimary ?? '#facc15';
          createDeathParticles(gameState.particles, gameState.TILE_SIZE, gameState.enemies[j].x, gameState.enemies[j].y, pColor);
          createSplatterParticles(gameState.particles, gameState.TILE_SIZE, gameState.enemies[j].x, gameState.enemies[j].y, pColor, 8);
          gameState.enemies.splice(j, 1);
          playSFX('enemy_death');
          updateUI();
        }
      }
      checkWaveEnd();

      gameState.bullets.splice(i, 1);
    } else {
      b.x += (dx / dist) * b.speed;
      b.y += (dy / dist) * b.speed;
    }
  }

  // 4. 飄字
  for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
    const ft = gameState.floatingTexts[i];
    ft.y -= 0.5; ft.life--; ft.alpha = ft.life / 45;
    if (ft.life <= 0) gameState.floatingTexts.splice(i, 1);
  }

  // 5. 臨時障礙倒計時
  for (let i = gameState.tempWalls.length - 1; i >= 0; i--) {
    gameState.tempWalls[i].lifetime--;
    if (gameState.tempWalls[i].lifetime <= 0) {
      const tw = gameState.tempWalls[i];
      gameState.grid[tw.x][tw.y] = 0;
      gameState.tempWalls.splice(i, 1);
      updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, cachedPathTiles, cachedFullPath);
    }
  }

  // 6. 更新粒子特效 (Phase 4)
  updateParticles(gameState.particles);

  // 7. 更新背景星星與天氣 (Phase 4)
  updateBgStars();
  updateWeather();
}

function updateBgStars() {
  for (const star of gameState.bgStars) {
    star.alpha += star.alphaSpeed;
    if (star.alpha > 1.0 || star.alpha < 0.2) {
      star.alphaSpeed = -star.alphaSpeed;
    }
  }
}

function updateWeather() {
  // 更新閃電計時
  if (gameState.currentWeather === 'thunder') {
    if (gameState.lightningActive > 0) {
      gameState.lightningActive--;
    } else {
      if (gameState.lightningTimer > 0) {
        gameState.lightningTimer--;
      } else {
        // 觸發閃電機率
        if (Math.random() < 0.005) {
          gameState.lightningActive = 10 + Math.floor(Math.random() * 15); // 閃電持續 10-25 幀
          gameState.lightningTimer = 180 + Math.floor(Math.random() * 240); // 隨機 3~7 秒冷卻
          generateLightningPaths();
        }
      }
    }
  } else {
    gameState.lightningActive = 0;
  }

  // 更新天氣粒子
  if (gameState.currentWeather === 'none') {
    gameState.weatherParticles = [];
    return;
  }

  // 1. 產生新粒子
  if (gameState.currentWeather === 'rain' || gameState.currentWeather === 'thunder') {
    // 雨/雷雨：每幀產生雨粒子
    const spawnCount = gameState.currentWeather === 'thunder' ? 4 : 2;
    for (let i = 0; i < spawnCount; i++) {
      gameState.weatherParticles.push({
        x: Math.random() * getDomRefs().canvas.width,
        y: -10,
        vx: -1.5 - Math.random() * 1.5,
        vy: 8 + Math.random() * 4,
        size: 1 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.4,
        length: 12 + Math.random() * 15
      });
    }
  } else if (gameState.currentWeather === 'fog') {
    // 霧氣粒子初始化與定時補充
    if (gameState.weatherParticles.length < 25) {
      const isInit = gameState.weatherParticles.length === 0;
      const spawnCount = isInit ? 25 : 1;
      for (let i = 0; i < spawnCount; i++) {
        gameState.weatherParticles.push({
          x: isInit ? Math.random() * getDomRefs().canvas.width : -120,
          y: Math.random() * getDomRefs().canvas.height,
          vx: 0.2 + Math.random() * 0.4,
          vy: (Math.random() - 0.5) * 0.1,
          size: 80 + Math.random() * 80,
          alpha: 0.02 + Math.random() * 0.05
        });
      }
    }
  }

  // 2. 移動並過濾粒子
  for (let i = gameState.weatherParticles.length - 1; i >= 0; i--) {
    const p = gameState.weatherParticles[i];
    p.x += p.vx;
    p.y += p.vy;

    // 邊界檢查
    if (gameState.currentWeather === 'rain' || gameState.currentWeather === 'thunder') {
      if (p.y > getDomRefs().canvas.height + 20 || p.x < -20) {
        gameState.weatherParticles.splice(i, 1);
      }
    } else if (gameState.currentWeather === 'fog') {
      if (p.x > getDomRefs().canvas.width + 150) {
        gameState.weatherParticles.splice(i, 1);
      }
    }
  }
}

function generateLightningPaths() {
  gameState.lightningPaths = [];
  const pathCount = 1 + Math.floor(Math.random() * 2);
  for (let p = 0; p < pathCount; p++) {
    const path: Point[] = [];
    let curX = 100 + Math.random() * (getDomRefs().canvas.width - 200);
    let curY = 0;
    path.push({ x: curX, y: curY });
    
    const segmentCount = 6 + Math.floor(Math.random() * 6);
    const targetY = getDomRefs().canvas.height * 0.6 + Math.random() * (getDomRefs().canvas.height * 0.4);
    const dy = targetY / segmentCount;
    
    for (let i = 0; i < segmentCount; i++) {
      curY += dy;
      curX += (Math.random() - 0.5) * 60;
      path.push({ x: curX, y: curY });
    }
    gameState.lightningPaths.push(path);
  }
}

// ============================================================
// 8. 結算
// ============================================================

function endBattle(isVictory: boolean) {
  if (gameState.animFrameId) { cancelAnimationFrame(gameState.animFrameId); gameState.animFrameId = null; }
  gameState.spawnTimers.forEach(t => clearInterval(t));
  gameState.spawnTimers = [];

  const earned = gameState.currentMap.id === 'test_level' ? 0 : calcTalentPointsEarned(gameState.wave);
  if (gameState.currentMap.id !== 'test_level') {
    addTalentPoints(gameState.talentData, earned);
  }

  const titleEl = document.getElementById('gameoverTitle')!;
  titleEl.textContent = isVictory ? '🎉 防禦成功！' : '💀 防禦失敗';
  titleEl.className = `gameover-title ${isVictory ? 'victory' : 'defeat'}`;

  document.getElementById('goWaveVal')!.textContent = gameState.wave.toString();
  document.getElementById('goKillVal')!.textContent = gameState.killCount.toString();
  document.getElementById('goTalentVal')!.textContent = `+${earned}`;
  document.getElementById('goDamageVal')!.textContent = gameState.totalDamageDealt.toLocaleString();
  document.getElementById('goStreakVal')!.textContent = gameState.maxKillStreak.toString();

  switchScene('GAME_OVER');
}

function checkWaveEnd() {
  if (gameState.enemies.length === 0 && gameState.isWaveActive) {
    gameState.isWaveActive = false;
    gameState.currentKillStreak = 0; // 波次間重置連殺計數
    showFloat(640, 320, '波次防禦成功！', '#10b981');
    gameState.gold += 15 + gameState.wave * 3;
    updateUI();
    // 達到最大波次則勝利 (測試關卡除外)
    if (gameState.currentMap.id !== 'test_level' && gameState.wave >= MAX_WAVES) {
      setTimeout(() => endBattle(true), 1500);
    } else {
      // 禁止超過最大波次 (測試關卡除外，可以無限挑戰)
      getDomRefs().btnStartWave.disabled = gameState.currentMap.id !== 'test_level' && gameState.wave >= MAX_WAVES;
    }
  }
}

// ============================================================
// 9. 渲染
// ============================================================

function renderGame() {
  const ctx = getDomRefs().ctx;
  const renderStart = performance.now();
  gameState.drawCallCount = 0;
  let bgFillStyle = '#020617';
  let gridStrokeStyle = '#1e293b';
  
  if (gameState.currentTheme === 'chinese') {
    bgFillStyle = '#2b0909';
    gridStrokeStyle = '#6b1d1d';
  } else if (gameState.currentTheme === 'ink') {
    bgFillStyle = '#f8fafc';
    gridStrokeStyle = '#e2e8f0';
  } else if (gameState.currentTheme === 'starry') {
    bgFillStyle = '#060a16';
    gridStrokeStyle = '#131e3a';
  }
  
  ctx.fillStyle = bgFillStyle;
  ctx.fillRect(0, 0, getDomRefs().canvas.width, getDomRefs().canvas.height);

  ctx.save();
  ctx.translate(gameState.mapOffsetX, gameState.mapOffsetY);
  ctx.scale(gameState.mapScale, gameState.mapScale);

  // 1. 繪製平鋪地板與路徑 Tile (極致原生像素風方案 D)
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      const isPath = cachedPathTiles.has(`${x},${y}`);
      drawTile(ctx, gameState.currentTheme, isPath, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.TILE_SIZE / 16, x, y);
      gameState.drawCallCount++;
    }
  }

  // 2. 繪製璀璨星空的背景星星 (疊加在星空地板上，微微閃爍)
  if (gameState.currentTheme === 'starry') {
    for (const star of gameState.bgStars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. 網格線
  ctx.strokeStyle = gridStrokeStyle; ctx.lineWidth = 0.5;
  for (let x = 0; x <= gameState.COLS; x++) { ctx.beginPath(); ctx.moveTo(x * gameState.TILE_SIZE, 0); ctx.lineTo(x * gameState.TILE_SIZE, gameState.ROWS * gameState.TILE_SIZE); ctx.stroke(); }
  for (let y = 0; y <= gameState.ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * gameState.TILE_SIZE); ctx.lineTo(gameState.COLS * gameState.TILE_SIZE, y * gameState.TILE_SIZE); ctx.stroke(); }

  // 4. 繪製常駐的半透明怪物行進路線與方向辨識 (非 MAP_EDITOR 狀態下)
  if (gameState.currentScene === 'BATTLE' && cachedFullPath.length > 0) {
    const routeScale = gameState.TILE_SIZE / 16;
    ctx.save();
    ctx.lineWidth = 1.5 * routeScale;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)'; // 非常低調的 25% 透明金黃色
    ctx.shadowBlur = 3 * routeScale;
    ctx.shadowColor = '#f59e0b';

    ctx.beginPath();
    const startX = cachedFullPath[0].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    const startY = cachedFullPath[0].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < cachedFullPath.length; i++) {
      const tx = cachedFullPath[i].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const ty = cachedFullPath[i].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // 繪製微型流動虛線
    ctx.lineWidth = 1.0 * routeScale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; // 半透明白色
    ctx.setLineDash([4 * routeScale, 10 * routeScale]);
    ctx.lineDashOffset = -(Date.now() / 25) * routeScale; // 移動速度慢一點，比較低調
    ctx.stroke();

    // 繪製常駐的方向箭頭
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 2 * routeScale;
    ctx.shadowColor = '#fbbf24';

    const arrowSpacing = 64 * routeScale; // 間距大一點，更加清爽
    const arrowSize = 2.5 * routeScale; // 箭頭小一點，不遮擋防禦塔
    const animOffset = (Date.now() / 25) % arrowSpacing;

    for (let i = 0; i < cachedFullPath.length - 1; i++) {
      const x1 = cachedFullPath[i].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const y1 = cachedFullPath[i].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const x2 = cachedFullPath[i+1].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const y2 = cachedFullPath[i+1].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const ux = dx / len;
      const uy = dy / len;

      let dist = animOffset;
      while (dist < len) {
        const ax = x1 + ux * dist;
        const ay = y1 + uy * dist;

        ctx.beginPath();
        ctx.moveTo(ax + ux * arrowSize * 1.5, ay + uy * arrowSize * 1.5);
        ctx.lineTo(ax - ux * arrowSize + uy * arrowSize * 0.8, ay - uy * arrowSize - ux * arrowSize * 0.8);
        ctx.lineTo(ax - ux * arrowSize - uy * arrowSize * 0.8, ay - uy * arrowSize + ux * arrowSize * 0.8);
        ctx.closePath();
        ctx.fill();

        dist += arrowSpacing;
      }
    }
    ctx.restore();
  }

  // 繪製地圖預設地形障礙物
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      if (gameState.grid[x][y] === 2) {
        drawObstacle(ctx, x * gameState.TILE_SIZE, y * gameState.TILE_SIZE, gameState.currentTheme, gameState.TILE_SIZE);
      }
    }
  }

  // 在教學關卡繪製推薦建造位置的高亮提示
  if (gameState.currentMap && gameState.currentMap.id === 'tutorial') {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    const rx = 58 * gameState.TILE_SIZE;
    const ry = 17 * gameState.TILE_SIZE;
    ctx.strokeRect(rx, ry, gameState.TILE_SIZE, gameState.TILE_SIZE);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💡 推薦建造點', rx - 18, ry - 4);
    ctx.restore();
  }

  // 起點 / 終點
  let spawnColor = '#22c55e';
  let baseColor = '#ef4444';
  if (gameState.currentTheme === 'chinese') {
    spawnColor = '#fbbf24'; // 帝王金起點
    baseColor = '#dc2626'; // 宮殿紅終點
  } else if (gameState.currentTheme === 'ink') {
    spawnColor = '#475569'; // 墨灰起點
    baseColor = '#0f172a'; // 濃墨終點
  } else if (gameState.currentTheme === 'starry') {
    spawnColor = '#06b6d4'; // 青色星雲
    baseColor = '#ec4899'; // 粉色超新星
  }

  ctx.fillStyle = spawnColor;
  ctx.fillRect(gameState.SPAWN_POINT.x * gameState.TILE_SIZE, gameState.SPAWN_POINT.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
  ctx.fillStyle = baseColor;
  ctx.fillRect(gameState.BASE_POINT.x * gameState.TILE_SIZE, gameState.BASE_POINT.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);

  // 檢查點
  gameState.WAYPOINTS.forEach((wp, idx) => {
    ctx.beginPath();
    const wpScale = gameState.TILE_SIZE / 16;
    ctx.arc(wp.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, wp.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, 10 * wpScale, 0, Math.PI * 2);
    
    let wpBg = '#f59e0b';
    let wpFg = '#fff';
    
    if (gameState.currentTheme === 'chinese') {
      wpBg = '#ea580c';
    } else if (gameState.currentTheme === 'ink') {
      wpBg = '#334155';
    } else if (gameState.currentTheme === 'starry') {
      wpBg = '#8b5cf6';
    }
    
    ctx.fillStyle = wpBg; ctx.fill();
    
    if (gameState.currentTheme === 'ink') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1 * wpScale;
      ctx.stroke();
    }
    
    ctx.fillStyle = wpFg; ctx.font = `bold ${Math.round(11 * wpScale)}px Outfit, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((idx + 1).toString(), wp.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2, wp.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2);
  });

  // 砲台（使用像素精靈）
  for (const t of gameState.towers) {
    drawTowerSprite(ctx, t.typeId, t.x * gameState.TILE_SIZE, t.y * gameState.TILE_SIZE, gameState.TILE_SIZE / 16, gameState.currentStyle, t.cooldown, t.def.fireRate, t.recoilY);
    gameState.drawCallCount++;

    // 合成模式高亮選中的第一座塔
    if (gameState.mergeMode && gameState.mergeFirstTower && gameState.mergeFirstTower.id === t.id) {
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
      ctx.strokeRect(t.x * gameState.TILE_SIZE, t.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    }
  }

  // 臨時障礙（靈木塔效果）
  for (const tw of gameState.tempWalls) {
    ctx.save();
    const alpha = Math.min(1, tw.lifetime / 60); // 最後 1 秒漸隱
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(tw.x * gameState.TILE_SIZE, tw.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1 * (gameState.TILE_SIZE / 16);
    ctx.strokeRect(tw.x * gameState.TILE_SIZE, tw.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    gameState.drawCallCount++;
    ctx.restore();
  }

  // 怪物（使用像素精靈）
  for (const e of gameState.enemies) {
    drawEnemySprite(ctx, e.type, e.x, e.y, e.hitFlashFrame, gameState.TILE_SIZE / 16, gameState.currentStyle, e.vx, e.vy, e.squashX, e.squashY);
    gameState.drawCallCount++;

    // 血條 (依地圖比例縮放)
    const hpPct = e.hp / e.maxHp;
    const hpScale = gameState.TILE_SIZE / 16;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(e.x - 8 * hpScale, e.y - 12 * hpScale, 16 * hpScale, 3 * hpScale);
    ctx.fillStyle = e.slowDuration > 0 ? '#06b6d4' : '#10b981';
    ctx.fillRect(e.x - 8 * hpScale, e.y - 12 * hpScale, 16 * hpScale * hpPct, 3 * hpScale);

    // DOT 指示
    if (e.dotDuration > 0) {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(e.x - 8 * hpScale, e.y - 9 * hpScale, 16 * hpScale * (e.dotDuration / 60), 1 * hpScale);
    }
  }

  // 子彈
  for (const b of gameState.bullets) {
    const bScale = gameState.TILE_SIZE / 16;
    const bulletThemes: Record<string, { core: string; mid: string; glow: string; trail: string; r: number }> = {
      fire: { core: '#fef08a', mid: '#f97316', glow: '#ef4444', trail: '#7f1c1d', r: 5 },
      water: { core: '#ffffff', mid: '#60a5fa', glow: '#2563eb', trail: '#1e3a8a', r: 4 },
      wood: { core: '#a7f3d0', mid: '#22c55e', glow: '#166534', trail: '#052e16', r: 4 },
      metal: { core: '#ffffff', mid: '#cbd5e1', glow: '#94a3b8', trail: '#475569', r: 5 },
      yin: { core: '#ffffff', mid: '#d8b4fe', glow: '#a855f7', trail: '#3b0764', r: 4 },
      yang: { core: '#ffffff', mid: '#fef08a', glow: '#fbbf24', trail: '#854d0e', r: 5 },
      earth: { core: '#fef08a', mid: '#f59e0b', glow: '#d97706', trail: '#78350f', r: 5 }
    };
    const theme = bulletThemes[b.element] || bulletThemes.fire;
    
    // 計算面向目標的追蹤方向以生成拖影
    let ux = 1;
    let uy = 0;
    if (b.targetEnemy) {
      const dx = b.targetEnemy.x - b.x;
      const dy = b.targetEnemy.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        ux = dx / dist;
        uy = dy / dist;
      }
    }
    
    // 1. 繪製多段追蹤拖影
    for (let i = 1; i < 5; i++) {
      const tx = b.x - i * 5 * bScale * ux;
      const ty = b.y - i * 5 * bScale * uy;
      const alpha = (1.0 - i / 5) * 0.65;
      const radius = (theme.r * (1.0 - i / 5) + 1.0) * bScale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 6 * bScale;
      ctx.shadowColor = theme.glow;
      ctx.fillStyle = theme.trail;
      ctx.beginPath();
      ctx.arc(tx, ty, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // 2. 繪製發光核心
    ctx.save();
    ctx.shadowBlur = 15 * bScale;
    ctx.shadowColor = theme.glow;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, theme.r * bScale);
    g.addColorStop(0, theme.core);
    g.addColorStop(0.5, theme.mid);
    g.addColorStop(1, theme.glow);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, theme.r * bScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    gameState.drawCallCount++;
  }

  // 飄字
  for (const ft of gameState.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    const fSize = (ft.fontSize || 11) * (gameState.TILE_SIZE / 16);
    ctx.font = `bold ${fSize}px Outfit, sans-serif`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    gameState.drawCallCount++;
    ctx.restore();
  }

  // 粒子特效 (Phase 4)
  for (const p of gameState.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    if (p.isRing) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
      ctx.shadowBlur = 12 * (gameState.TILE_SIZE / 16);
      ctx.shadowColor = p.color;
      ctx.stroke();
      gameState.drawCallCount++;
    } else if (p.isPixel) {
      // 懷舊硬派像素粒子：繪製正方形，不加發光陰影
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      gameState.drawCallCount++;
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4 * (gameState.TILE_SIZE / 16);
      ctx.shadowColor = p.color;
      ctx.fill();
      gameState.drawCallCount++;
    }
    ctx.restore();
  }

  if (gameState.routePreviewTimer > 0) {
    drawRoutePreview(ctx, gameState.cachedPreviewRoute, gameState.TILE_SIZE, gameState.routePreviewTimer);
  }

  ctx.restore(); // 結束地圖相關縮放與平移 (Phase 4)

  // === 繪製天氣特效 Overlay ===
  if (gameState.currentWeather === 'rain' || gameState.currentWeather === 'thunder') {
    ctx.save();
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
    for (const p of gameState.weatherParticles) {
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 1.5, p.y + p.vy * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  } else if (gameState.currentWeather === 'fog') {
    ctx.save();
    for (const p of gameState.weatherParticles) {
      const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      radGrad.addColorStop(0, `rgba(226, 232, 240, ${p.alpha})`);
      radGrad.addColorStop(0.5, `rgba(226, 232, 240, ${p.alpha * 0.5})`);
      radGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 繪製雷電效果
  if (gameState.currentWeather === 'thunder' && gameState.lightningActive > 0) {
    ctx.save();
    if (Math.random() < 0.7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.random() * 0.25})`;
      ctx.fillRect(0, 0, getDomRefs().canvas.width, getDomRefs().canvas.height);
    }

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#e0f2fe';
    ctx.lineWidth = 2.5 + Math.random() * 2;
    
    for (const path of gameState.lightningPaths) {
      if (path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 繪製阻塞警告文字（固定在畫布中心，不受平移和縮放影響）
  if (gameState.routePreviewTimer > 0 && gameState.cachedPreviewRoute.length === 0) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 路線被完全阻塞！無法通往基地', getDomRefs().canvas.width / 2, getDomRefs().canvas.height / 2);
    ctx.restore();
  }

  // 性能監控指標更新
  const latency = performance.now() - renderStart;
  gameState.frameCount++;
  const now = performance.now();
  if (now - gameState.lastFpsUpdateTime > 1000) {
    gameState.currentFps = Math.round((gameState.frameCount * 1000) / (now - gameState.lastFpsUpdateTime));
    gameState.frameCount = 0;
    gameState.lastFpsUpdateTime = now;
  }

  if (gameState.isDiagnosticOpen) {
    getDomRefs().diagFps.textContent = gameState.currentFps.toString();
    getDomRefs().diagLatency.textContent = latency.toFixed(1) + ' ms';
    getDomRefs().diagDrawCalls.textContent = gameState.drawCallCount.toString();
    getDomRefs().diagCacheSize.textContent = spriteCache.size.toString();
    getDomRefs().diagMonsters.textContent = gameState.enemies.length.toString();
    getDomRefs().diagTowers.textContent = gameState.towers.length.toString();
    getDomRefs().diagFilterWarning.textContent = '0'; // 所有主渲染濾鏡已完全移除快取化，調用次數為 0
  }
}

function showFloat(x: number, y: number, text: string, color: string, fontSize?: number) {
  gameState.floatingTexts.push({ x, y, text, color, alpha: 1.0, life: 45, fontSize });
}

function updateUI() {
  getDomRefs().hpVal.textContent = gameState.currentMap.id === 'test_level' ? '∞' : Math.floor(gameState.hp).toString();
  getDomRefs().goldVal.textContent = gameState.currentMap.id === 'test_level' ? '∞' : gameState.gold.toString();
  getDomRefs().waveVal.textContent = gameState.wave.toString();
  getDomRefs().killVal.textContent = gameState.killCount.toString();
  getDomRefs().btnStartWave.disabled = gameState.isWaveActive || (gameState.currentMap.id !== 'test_level' && gameState.wave >= MAX_WAVES);
  updateWaveProgress();

  const testControls = document.getElementById('testControls');
  if (testControls) {
    testControls.style.display = gameState.currentMap.id === 'test_level' ? 'flex' : 'none';
  }
}

function updateWaveProgress() {
  if (!gameState.isWaveActive) {
    getDomRefs().waveProgressLabel.textContent = '待機中';
    getDomRefs().waveEnemyCount.textContent = '';
    getDomRefs().waveProgressFill.style.width = '0%';
    getDomRefs().waveProgressFill.classList.add('idle');
    return;
  }
  getDomRefs().waveProgressFill.classList.remove('idle');
  const alive = gameState.enemies.length;
  // remaining = 已生成中還活著的 + 尚未生成的 (gameState.waveTotal - gameState.waveSpawned)
  const remaining = alive + Math.max(0, gameState.waveTotal - gameState.waveSpawned);
  const pct = gameState.waveTotal > 0 ? (1 - remaining / gameState.waveTotal) * 100 : 100;
  getDomRefs().waveProgressFill.style.width = `${Math.min(100, pct)}%`;
  getDomRefs().waveProgressLabel.textContent = `波次 ${gameState.wave} 進行中`;
  getDomRefs().waveEnemyCount.textContent = remaining > 0 ? `剩餘 ${remaining} 隻` : '即將結束...';
}

// ============================================================
// 11. 事件綁定與初始化
// ============================================================


// 主介面按鈕
document.getElementById('btnStartGame')!.addEventListener('click', () => { playSFX('click'); switchScene('LEVEL_SELECT'); });
document.getElementById('btnBackFromLevel')!.addEventListener('click', () => { playSFX('click'); switchScene('MAIN_MENU'); });
document.getElementById('btnTalent')!.addEventListener('click', () => { playSFX('click'); switchScene('TALENT_SCREEN'); });
document.getElementById('btnBackFromTalent')!.addEventListener('click', () => { playSFX('click'); switchScene('MAIN_MENU'); });
document.getElementById('btnBackToMenu')!.addEventListener('click', () => { playSFX('click'); switchScene('MAIN_MENU'); });
document.getElementById('btnResetTalents')!.addEventListener('click', () => {
  if (confirm('確定要重置所有天賦嗎？已花費的天賦點將全部退回。')) {
    resetTalents(gameState.talentData);
    renderTalentScreen();
  }
});

// 戰鬥場景按鈕
getDomRefs().btnMerge.addEventListener('click', () => {
  playSFX('click');
  gameState.mergeMode = !gameState.mergeMode;
  gameState.mergeFirstTower = null;
  if (gameState.mergeMode) gameState.selectedTool = '';
  refreshToolSelection();
});
getDomRefs().btnSell.addEventListener('click', () => {
  playSFX('click');
  gameState.mergeMode = false; gameState.mergeFirstTower = null;
  gameState.selectedTool = 'sell';
  refreshToolSelection();
});
getDomRefs().btnQuitBattle.addEventListener('click', () => {
  playSFX('click');
  if (confirm('確定放棄本局嗎？將進行天賦結算。')) {
    endBattle(false);
  }
});

getDomRefs().btnDiagnostics.addEventListener('click', () => {
  playSFX('click');
  gameState.isDiagnosticOpen = !gameState.isDiagnosticOpen;
  (getDomRefs().diagnosticPanel as HTMLElement).style.display = gameState.isDiagnosticOpen ? 'block' : 'none';
  getDomRefs().btnDiagnostics.classList.toggle('active', gameState.isDiagnosticOpen);
});

getDomRefs().btnDiagExport.addEventListener('click', () => {
  playSFX('click');
  const cacheKeys = Array.from(spriteCache.keys());
  const report = {
    timestamp: new Date().toISOString(),
    fps: gameState.currentFps,
    monstersCount: gameState.enemies.length,
    towersCount: gameState.towers.length,
    bulletsCount: gameState.bullets.length,
    particlesCount: gameState.particles.length,
    drawCalls: gameState.drawCallCount,
    spriteCacheSize: spriteCache.size,
    spriteCacheKeys: cacheKeys,
    userGold: gameState.gold,
    userHP: gameState.hp,
    currentWave: gameState.wave,
    talentSaveData: loadTalentData(),
    devicePixelRatio: window.devicePixelRatio,
    browserAgent: navigator.userAgent
  };
  
  console.group('%c⚙️ Wuxing Maze TD — Performance Diagnostic Profile', 'color: #8b5cf6; font-weight: bold; font-size: 1.15rem;');
  console.log('%cGeneral Game Stats:', 'color: #38bdf8; font-weight: bold;');
  console.table({
    'FPS': report.fps,
    'Monsters': report.monstersCount,
    'Towers': report.towersCount,
    'Bullets': report.bulletsCount,
    'Particles': report.particlesCount,
    'Draw Calls (Last Frame)': report.drawCalls,
    'Cache Canvas Size': report.spriteCacheSize,
    'HP': report.userHP,
    'Gold': report.userGold,
    'Current Wave': report.currentWave
  });
  console.log('%cSprite Cache Inventory:', 'color: #fbbf24; font-weight: bold;', report.spriteCacheKeys);
  console.log('%cComplete Raw Profile Data:', 'color: #10b981; font-weight: bold;', report);
  console.groupEnd();

  gameState.floatingTexts.push({
    x: getDomRefs().canvas.width / 2,
    y: getDomRefs().canvas.height / 2 - 40,
    text: '📋 性能診斷報告已導出至 Console (F12)！',
    color: '#fbbf24',
    alpha: 1.0,
    life: 120,
    fontSize: 18
  });
});

getDomRefs().btnShowRoute.addEventListener('click', () => {
  playSFX('click');
  let fullPath: Point[] = [];
  let currentStart = gameState.SPAWN_POINT;
  const targets = [...gameState.WAYPOINTS, gameState.BASE_POINT];
  let blocked = false;
  
  for (const target of targets) {
    const segment = astarFind(currentStart, target, gameState.grid, gameState.COLS, gameState.ROWS, false);
    if (segment) {
      if (fullPath.length > 0) {
        fullPath = fullPath.concat(segment.slice(1));
      } else {
        fullPath = fullPath.concat(segment);
      }
      currentStart = target;
    } else {
      blocked = true;
      break;
    }
  }

  if (blocked) {
    gameState.cachedPreviewRoute = [];
  } else {
    gameState.cachedPreviewRoute = fullPath;
  }
  gameState.routePreviewTimer = 180; // 3 秒
});

getDomRefs().selectTheme.addEventListener('change', () => {
  gameState.currentTheme = getDomRefs().selectTheme.value as ThemeId;
  playSFX('click');
});

getDomRefs().selectWeather.addEventListener('change', () => {
  gameState.currentWeather = getDomRefs().selectWeather.value as WeatherId;
  playSFX('click');
  if (gameState.currentWeather === 'thunder') {
    gameState.lightningTimer = 60 + Math.random() * 120;
  }
});

getDomRefs().selectStyle.addEventListener('change', () => {
  gameState.currentStyle = getDomRefs().selectStyle.value as 'pixel' | 'highres';
  playSFX('click');
});

// 初始化
gameState.talentData = loadTalentData();
initSprites();
loadAllHighResSprites();
refreshMenuTalentInfo();
initBgmUnlocker();
setupMusicToggle();

/** 批量載入所有防禦塔與怪物的高品質 SD 精靈圖 */
function loadAllHighResSprites(): void {
  const SPRITE_BASE = 'assets/sprites';
  const imagePreloads: Array<[string, string]> = [
    // --- 怪物 ---
    ['enemy_snake',        `${SPRITE_BASE}/enemies/snake.png`],
    ['enemy_fly',          `${SPRITE_BASE}/enemies/fly.png`],
    ['enemy_salamander',   `${SPRITE_BASE}/enemies/salamander.png`],
    ['enemy_water_spirit', `${SPRITE_BASE}/enemies/water_spirit.png`],
    ['enemy_golem',        `${SPRITE_BASE}/enemies/golem.png`],
    ['enemy_beetle',       `${SPRITE_BASE}/enemies/beetle.png`],
    ['enemy_boss_dragon',  `${SPRITE_BASE}/enemies/boss_dragon.png`],
    // --- 基礎塔 ---
    ['tower_fire',         `${SPRITE_BASE}/towers/fire.png`],
    ['tower_water',        `${SPRITE_BASE}/towers/water.png`],
    ['tower_wood',         `${SPRITE_BASE}/towers/wood.png`],
    ['tower_earth',        `${SPRITE_BASE}/towers/earth.png`],
    ['tower_metal',        `${SPRITE_BASE}/towers/metal.png`],
    ['tower_yin',          `${SPRITE_BASE}/towers/yin.png`],
    ['tower_yang',         `${SPRITE_BASE}/towers/yang.png`],
    // --- Lv2 塔 ---
    ['tower_fire_2',       `${SPRITE_BASE}/towers_lv2/fire_2.png`],
    ['tower_water_2',      `${SPRITE_BASE}/towers_lv2/water_2.png`],
    ['tower_wood_2',       `${SPRITE_BASE}/towers_lv2/wood_2.png`],
    ['tower_earth_2',      `${SPRITE_BASE}/towers_lv2/earth_2.png`],
    ['tower_metal_2',      `${SPRITE_BASE}/towers_lv2/metal_2.png`],
    ['tower_yin_2',        `${SPRITE_BASE}/towers_lv2/yin_2.png`],
    ['tower_yang_2',       `${SPRITE_BASE}/towers_lv2/yang_2.png`],
    // --- 配方塔 ---
    ['tower_wood_fire',    `${SPRITE_BASE}/towers_recipe/wood_fire.png`],
    ['tower_fire_earth',   `${SPRITE_BASE}/towers_recipe/fire_earth.png`],
    ['tower_earth_metal',  `${SPRITE_BASE}/towers_recipe/earth_metal.png`],
    ['tower_metal_water',  `${SPRITE_BASE}/towers_recipe/metal_water.png`],
    ['tower_water_wood',   `${SPRITE_BASE}/towers_recipe/water_wood.png`],
    ['tower_yin_yang',     `${SPRITE_BASE}/towers_recipe/yin_yang.png`],
  ];
  imagePreloads.forEach(([key, src]) => {
    preloadImage(key, src);
  });
}

// ============================================================
// 天賦分支快速導覽列事件綁定
// ============================================================
(function initTalentNav() {
  const navBtns = document.querySelectorAll<HTMLButtonElement>('#talentNav .talent-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const trackId = btn.getAttribute('data-track');
      if (!trackId) return;

      // 高亮點擊的按鈕
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 平滑捲動至對應分支
      const trackEl = document.getElementById(trackId);
      if (trackEl) {
        trackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 使用 IntersectionObserver 自動更新高亮：當 track 進入視野時同步按鈕狀態
  const trackIds = ['track-base', 'track-attack', 'track-element', 'track-yinyang'];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navBtns.forEach(b => {
          if (b.getAttribute('data-track') === id) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.4 });

  trackIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();

// ============================================================
// 11. 行動裝置與手勢拖曳平移、雙指縮放處理 (Phase 4)
// ============================================================

// Auto-fit 縮放整個 game-container
function resizeGameContainer() {
  const container = document.querySelector('.game-container') as HTMLElement;
  if (!container) return;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const baseWidth = 1304; // 1280px + padding + border
  // 測試關卡因為有額外的測試工具面板，高度會比較高，給予較大的 baseHeight
  const isTest = typeof gameState.currentMap !== 'undefined' && gameState.currentMap && gameState.currentMap.id === 'test_level';
  const baseHeight = isTest ? 830 : 780; 

  const padding = 12; // 留點邊距緩衝
  const targetWidth = windowWidth - padding * 2;
  const targetHeight = windowHeight - padding * 2;

  const scaleX = targetWidth / baseWidth;
  const scaleY = targetHeight / baseHeight;

  // 取較小值，且最大縮放值為 1 (只縮小，不放大)
  let scale = Math.min(scaleX, scaleY);
  if (scale > 1) scale = 1;

  if (scale < 1) {
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'top center';
    if (container.parentElement) {
      container.parentElement.style.height = `${baseHeight * scale}px`;
    }
  } else {
    container.style.transform = '';
    container.style.transformOrigin = '';
    if (container.parentElement) {
      container.parentElement.style.height = '';
    }
  }
}
window.addEventListener('resize', resizeGameContainer);

// 滑鼠/觸控拖曳平移與縮放實現
function handlePointerDown(clientX: number, clientY: number) {
  gameState.isPointerDown = true;
  gameState.startPointerX = clientX;
  gameState.startPointerY = clientY;
  gameState.isDraggingMap = false;
}

function handlePointerMove(clientX: number, clientY: number) {
  if (!gameState.isPointerDown) return;
  const dx = clientX - gameState.startPointerX;
  const dy = clientY - gameState.startPointerY;

  if (!gameState.isDraggingMap && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
    gameState.isDraggingMap = true;
  }

  if (gameState.isDraggingMap) {
    gameState.mapOffsetX += dx;
    gameState.mapOffsetY += dy;

    // 限制拖曳邊界，避免完全拖出視野
    const limitX = getDomRefs().canvas.width * gameState.mapScale - getDomRefs().canvas.width;
    const limitY = getDomRefs().canvas.height * gameState.mapScale - getDomRefs().canvas.height;
    gameState.mapOffsetX = Math.max(-limitX - 100, Math.min(100, gameState.mapOffsetX));
    gameState.mapOffsetY = Math.max(-limitY - 100, Math.min(100, gameState.mapOffsetY));

    gameState.startPointerX = clientX;
    gameState.startPointerY = clientY;
  }
}

function handlePointerUp() {
  gameState.isPointerDown = false;
}

// 註冊滑鼠事件
getDomRefs().canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // 左鍵
    handlePointerDown(e.clientX, e.clientY);
  }
});

getDomRefs().canvas.addEventListener('mousemove', (e) => {
  handlePointerMove(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
  handlePointerUp();
});

// 註冊觸控事件（包含雙指捏合縮放）
getDomRefs().canvas.addEventListener('touchstart', (e) => {
  if (gameState.currentScene !== 'BATTLE') return;
  if (e.touches.length === 1) {
    handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    gameState.isPointerDown = false;
    gameState.isDraggingMap = true; // 雙指操作時禁止下塔
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    gameState.lastTouchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: true });

getDomRefs().canvas.addEventListener('touchmove', (e) => {
  if (gameState.currentScene !== 'BATTLE') return;
  if (e.touches.length === 1) {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (gameState.lastTouchDist > 0) {
      const factor = dist / gameState.lastTouchDist;
      const newScale = Math.max(0.5, Math.min(3.0, gameState.mapScale * factor));

      const rect = getDomRefs().canvas.getBoundingClientRect();
      const rawCenterX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
      const rawCenterY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
      const centerX = rawCenterX * (getDomRefs().canvas.width / rect.width);
      const centerY = rawCenterY * (getDomRefs().canvas.height / rect.height);

      const worldX = (centerX - gameState.mapOffsetX) / gameState.mapScale;
      const worldY = (centerY - gameState.mapOffsetY) / gameState.mapScale;

      gameState.mapScale = newScale;
      gameState.mapOffsetX = centerX - worldX * gameState.mapScale;
      gameState.mapOffsetY = centerY - worldY * gameState.mapScale;
    }
    gameState.lastTouchDist = dist;
  }
}, { passive: true });

getDomRefs().canvas.addEventListener('touchend', () => {
  handlePointerUp();
  gameState.lastTouchDist = 0;
});

getDomRefs().canvas.addEventListener('wheel', (e) => {
  if (gameState.currentScene !== 'BATTLE') return;
  e.preventDefault();
  const rect = getDomRefs().canvas.getBoundingClientRect();
  const centerX = (e.clientX - rect.left) * (getDomRefs().canvas.width / rect.width);
  const centerY = (e.clientY - rect.top) * (getDomRefs().canvas.height / rect.height);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const newScale = Math.max(0.5, Math.min(3.0, gameState.mapScale * factor));
  const worldX = (centerX - gameState.mapOffsetX) / gameState.mapScale;
  const worldY = (centerY - gameState.mapOffsetY) / gameState.mapScale;
  gameState.mapScale = newScale;
  gameState.mapOffsetX = centerX - worldX * gameState.mapScale;
  gameState.mapOffsetY = centerY - worldY * gameState.mapScale;
}, { passive: false });

// 註冊測試調試放怪按鈕事件
const btnSpawnTestMonster = document.getElementById('btnSpawnTestMonster')! as HTMLButtonElement;
const testMonsterSelect = document.getElementById('testMonsterSelect')! as HTMLSelectElement;

btnSpawnTestMonster.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameState.currentScene !== 'BATTLE') return;
  playSFX('click');
  const enemyType = testMonsterSelect.value as EnemyTypeId;
  spawnTestEnemy(enemyType);
});

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
initVersionAndReleaseNotes();


