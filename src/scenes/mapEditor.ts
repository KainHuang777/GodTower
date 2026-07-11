// src/scenes/mapEditor.ts — 地圖編輯器邏輯

import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { astarFind } from '../battle/pathfinding';
import { loadCustomMaps, saveCustomMaps, MapConfig } from '../maps';
import { playSFX } from '../audio/audioSystem';
import { EditorTool } from '../types';

export function initEditor() {
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

export function startEditorLoop() {
  if (gameState.editorAnimId) cancelAnimationFrame(gameState.editorAnimId);
  function loop() {
    if (gameState.currentScene !== 'MAP_EDITOR') return;
    renderEditor();
    gameState.editorAnimId = requestAnimationFrame(loop);
  }
  gameState.editorAnimId = requestAnimationFrame(loop);
}

export function renderEditor() {
  const ctx = getDomRefs().editorCtx;
  const W = getDomRefs().editorCanvasEl.width;
  const H = getDomRefs().editorCanvasEl.height;
  
  // 背景
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, W, H);

  // 網格線
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= gameState.COLS; x++) { 
    ctx.beginPath(); ctx.moveTo(x * gameState.TILE_SIZE, 0); ctx.lineTo(x * gameState.TILE_SIZE, gameState.ROWS * gameState.TILE_SIZE); ctx.stroke(); 
  }
  for (let y = 0; y <= gameState.ROWS; y++) { 
    ctx.beginPath(); ctx.moveTo(0, y * gameState.TILE_SIZE); ctx.lineTo(gameState.COLS * gameState.TILE_SIZE, y * gameState.TILE_SIZE); ctx.stroke(); 
  }

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

export function editorClickAt(gx: number, gy: number, isRightClick: boolean) {
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

export function updateEditorStatus() {
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

export function editorValidatePath(): boolean {
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

export function editorSave() {
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
  if (gameState.switchScene) {
    gameState.switchScene('LEVEL_SELECT');
  }
}

// 綁定編輯器事件與按鈕監聽
export function initMapEditorEvents() {
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
  document.getElementById('btnBackFromEditor')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (gameState.switchScene) gameState.switchScene('LEVEL_SELECT'); 
  });
  document.getElementById('btnCreateMap')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (gameState.switchScene) gameState.switchScene('MAP_EDITOR'); 
  });
}

// 註冊至 gameState
gameState.initEditor = initEditor;
gameState.renderEditor = renderEditor;
