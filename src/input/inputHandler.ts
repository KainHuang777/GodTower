// src/input/inputHandler.ts — 輸入事件與快捷鍵處理

import { gameState } from '../state';
import { MAPS } from '../maps';
import { getDomRefs } from '../domRefs';
import { handleBuild, handleSell, handleMergeClick } from '../battle/towerActions';
import { spawnTestEnemy } from '../battle/battleManager';
import { playSFX } from '../audio/audioSystem';
import { resetTalents, loadTalentData } from '../talent';
import { spriteCache } from '../sprites';
import { astarFind } from '../battle/pathfinding';
import { ThemeId, WeatherId, Point, MAX_WAVES } from '../types';
import { EnemyTypeId } from '../enemies';
import { updateTileCacheCanvas } from '../renderer/tileCache';
import { updateUI, showTooltip, hideTooltip } from '../ui/uiManager';
import { initWuxingCompass, updateCompassHighlight } from '../ui/wuxingCompass';
import { initRecipeCodex } from '../ui/recipeCodex';

const dragThreshold = 5;

function snapToTileCenter(worldX: number, worldY: number): {gx: number, gy: number} {
  let bestGx = Math.max(0, Math.min(gameState.COLS - 1, Math.floor(worldX / gameState.TILE_SIZE)));
  let bestGy = Math.max(0, Math.min(gameState.ROWS - 1, Math.floor(worldY / gameState.TILE_SIZE)));
  let minDist = Infinity;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const testGx = Math.max(0, Math.min(gameState.COLS - 1, bestGx + dx));
      const testGy = Math.max(0, Math.min(gameState.ROWS - 1, bestGy + dy));
      const tileCenterX = testGx * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const tileCenterY = testGy * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      
      const dist = Math.sqrt((worldX - tileCenterX) ** 2 + (worldY - tileCenterY) ** 2);
      if (dist <= 12 && dist < minDist) {
        minDist = dist;
        bestGx = testGx;
        bestGy = testGy;
      }
    }
  }
  return { gx: bestGx, gy: bestGy };
}

// Auto-fit 縮放整個 game-container
export function resizeGameContainer() {
  const container = document.querySelector('.game-container') as HTMLElement;
  if (!container) return;

  // 重置縮放以量測真實無縮放的寬高
  container.style.transform = '';
  container.style.transformOrigin = '';

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 使用 offsetWidth 和 offsetHeight 動態讀取當前的無縮放真實尺寸
  const baseWidth = container.offsetWidth || 1304;
  const baseHeight = container.offsetHeight || 850;

  const padding = 16; // 稍微多留一些邊距緩衝
  const targetWidth = windowWidth - padding * 2;
  const targetHeight = windowHeight - padding * 2;

  const scaleX = targetWidth / baseWidth;
  const scaleY = targetHeight / baseHeight;

  // 取較小值，最大為 1，最小限制為 0.5 (防極端縮小)
  let scale = Math.min(scaleX, scaleY);
  if (scale > 1) scale = 1;
  if (scale < 0.5) scale = 0.5;

  if (scale < 1) {
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'center center';
  }
}

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

export function initInputEvents() {
  // 視窗 resize
  window.addEventListener('resize', resizeGameContainer);

  // 註冊滑鼠事件
  getDomRefs().canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // 左鍵
      handlePointerDown(e.clientX, e.clientY);
    }
  });

  getDomRefs().canvas.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);

    // 計算懸停座標
    if (gameState.currentScene === 'BATTLE') {
      const rect = getDomRefs().canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (getDomRefs().canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (getDomRefs().canvas.height / rect.height);
      const worldX = (mouseX - gameState.mapOffsetX) / gameState.mapScale;
      const worldY = (mouseY - gameState.mapOffsetY) / gameState.mapScale;
      gameState.hoverGridX = Math.floor(worldX / gameState.TILE_SIZE);
      gameState.hoverGridY = Math.floor(worldY / gameState.TILE_SIZE);

      const hoverTower = gameState.towers.find(t => t.x === gameState.hoverGridX && t.y === gameState.hoverGridY);
      if (hoverTower) {
        showTooltip(e, hoverTower.typeId, hoverTower.def, hoverTower.def.cost, true, hoverTower);
      } else {
        hideTooltip();
      }
    }
  });

  getDomRefs().canvas.addEventListener('mouseleave', () => {
    gameState.hoverGridX = null;
    gameState.hoverGridY = null;
    hideTooltip();
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

  // 點擊地圖建造/合成
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

    const { gx, gy } = snapToTileCenter(worldX, worldY);

    if (gameState.mergeMode) {
      handleMergeClick(gx, gy);
      return;
    }

    if (gameState.selectedTool === 'sell') {
      handleSell(gx, gy);
      return;
    }

    const clickedTower = gameState.towers.find(t => t.x === gx && t.y === gy);
    if (clickedTower) {
      if (gameState.selectedTower && gameState.selectedTower.id === clickedTower.id) {
        gameState.selectedTower = null;
      } else {
        gameState.selectedTower = clickedTower;
        gameState.selectedTool = ''; // 清除建塔工具，避免衝突
        if (gameState.refreshToolSelection) {
          gameState.refreshToolSelection();
        }
      }
    } else {
      if (gameState.selectedTool && gameState.selectedTool !== 'sell') {
        handleBuild(gx, gy);
      } else {
        gameState.selectedTower = null;
      }
    }
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

    const { gx, gy } = snapToTileCenter(worldX, worldY);
    handleSell(gx, gy);
  });

  document.getElementById('btnStartGame')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (!gameState.talentData.hasPlayedBefore) {
      const tutorialMap = MAPS.find(m => m.id === 'tutorial') || MAPS[1];
      gameState.currentMap = tutorialMap;
      gameState.levelTutorialStep = 'intro';
      if (gameState.switchScene) gameState.switchScene('BATTLE');
    } else {
      if (gameState.switchScene) gameState.switchScene('LEVEL_SELECT'); 
    }
  });
  document.getElementById('btnBackFromLevel')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (gameState.switchScene) gameState.switchScene('MAIN_MENU'); 
  });
  document.getElementById('btnTalent')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (gameState.switchScene) gameState.switchScene('TALENT_SCREEN'); 
  });
  document.getElementById('btnBackFromTalent')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (gameState.switchScene) gameState.switchScene('MAIN_MENU'); 
  });
  document.getElementById('btnBackToMenu')!.addEventListener('click', () => { 
    playSFX('click'); 
    if (gameState.talentTutorialActive) {
      if (gameState.switchScene) gameState.switchScene('TALENT_SCREEN');
    } else {
      if (gameState.switchScene) gameState.switchScene('MAIN_MENU'); 
    }
  });
  
  document.getElementById('btnResetTalents')!.addEventListener('click', () => {
    if (confirm('確定要重置所有天賦嗎？已花費的天賦點將全部退回。')) {
      resetTalents(gameState.talentData);
      if (gameState.renderTalentScreen) {
        gameState.renderTalentScreen();
      }
    }
  });

  // 天賦分支快速導覽按鈕事件
  const navBtns = document.querySelectorAll('.talent-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 如果天賦引導活躍，禁止切換分頁，保證引導聚焦
      if (gameState.talentTutorialActive) return;
      
      playSFX('click');
      const trackId = btn.getAttribute('data-track');
      if (trackId) {
        gameState.activeTalentTrack = trackId as any;
        if (gameState.renderTalentScreen) {
          gameState.renderTalentScreen();
        }
      }
    });
  });

  // 戰鬥控制按鈕
  getDomRefs().btnStartWave.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState.isWaveActive) return;
    
    const maxWaves = gameState.currentMap.id === 'tutorial' ? 5 : MAX_WAVES;
    if (gameState.currentMap.id !== 'test_level' && gameState.wave >= maxWaves) return;

    if (gameState.levelTutorialStep === 'start_wave') {
      gameState.levelTutorialStep = 'wave_1_active';
    } else if (gameState.levelTutorialStep === 'wave_5_guide') {
      gameState.levelTutorialStep = 'completed';
    }

    playSFX('click');
    gameState.isWaveActive = true;
    gameState.wave++;
    if (gameState.spawnWave) {
      gameState.spawnWave(gameState.wave);
    }
    updateUI();
  });

  getDomRefs().btnMerge.addEventListener('click', () => {
    playSFX('click');
    gameState.mergeMode = !gameState.mergeMode;
    gameState.mergeFirstTower = null;
    if (gameState.mergeMode) gameState.selectedTool = '';
    if (gameState.refreshToolSelection) {
      gameState.refreshToolSelection();
    }
  });

  getDomRefs().btnSell.addEventListener('click', () => {
    playSFX('click');
    gameState.mergeMode = false; 
    gameState.mergeFirstTower = null;
    gameState.selectedTool = 'sell';
    if (gameState.refreshToolSelection) {
      gameState.refreshToolSelection();
    }
  });

  getDomRefs().btnQuitBattle.addEventListener('click', () => {
    playSFX('click');
    if (confirm('確定放棄本局嗎？將進行天賦結算。')) {
      if ((gameState as any).endBattle) {
        (gameState as any).endBattle(false);
      }
    }
  });

  // 診斷監控
  getDomRefs().btnDiagnostics.addEventListener('click', () => {
    playSFX('click');
    gameState.isDiagnosticOpen = !gameState.isDiagnosticOpen;
    (getDomRefs().diagnosticPanel as HTMLElement).style.display = gameState.isDiagnosticOpen ? 'block' : 'none';
    getDomRefs().btnDiagnostics.classList.toggle('active', gameState.isDiagnosticOpen);
  });

  getDomRefs().btnDiagBench.addEventListener('click', () => {
    playSFX('click');
    if (gameState.startPerformanceBenchmark) {
      gameState.startPerformanceBenchmark();
    }
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
    updateTileCacheCanvas();
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

  // 測試調試放怪按鈕
  const btnSpawnTestMonster = document.getElementById('btnSpawnTestMonster')! as HTMLButtonElement;
  const testMonsterSelect = document.getElementById('testMonsterSelect')! as HTMLSelectElement;

  if (btnSpawnTestMonster && testMonsterSelect) {
    btnSpawnTestMonster.addEventListener('click', (e) => {
      e.stopPropagation();
      if (gameState.currentScene !== 'BATTLE') return;
      playSFX('click');
      const enemyType = testMonsterSelect.value as EnemyTypeId;
      spawnTestEnemy(enemyType);
    });
  }

  // 速度切換與配方書點擊事件
  getDomRefs().btnSpeed.addEventListener('click', (e) => {
    e.stopPropagation();
    playSFX('click');
    gameState.gameSpeed = gameState.gameSpeed === 1 ? 2 : gameState.gameSpeed === 2 ? 3 : 1;
    getDomRefs().btnSpeed.textContent = `⚡ ${gameState.gameSpeed}x`;

    if (gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep === 'speed_guide') {
      gameState.levelTutorialStep = 'idle';
      updateUI();
    }
  });

  // 初始化羅盤與配方書
  initWuxingCompass();
  initRecipeCodex();

  // 滑鼠懸停砲台按鈕與羅盤互動 (事件委派)
  getDomRefs().towerButtonsContainer.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest('[data-tool]');
    if (target) {
      const tool = target.getAttribute('data-tool');
      if (tool && ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'].includes(tool)) {
        gameState.hoveredTowerBtn = tool;
        updateCompassHighlight();
      }
    }
  });

  getDomRefs().towerButtonsContainer.addEventListener('mouseout', () => {
    gameState.hoveredTowerBtn = null;
    updateCompassHighlight();
  });

  // 拖放建塔 (Drag & Drop) 邏輯
  getDomRefs().towerButtonsContainer.addEventListener('mousedown', (e) => {
    const target = (e.target as HTMLElement).closest('[data-tool]');
    if (target && e.button === 0) {
      const tool = target.getAttribute('data-tool');
      if (tool && ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'].includes(tool)) {
        gameState.draggedTowerTypeId = tool;
        gameState.dragMousePos = { x: e.clientX, y: e.clientY };
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (gameState.draggedTowerTypeId) {
      gameState.dragMousePos = { x: e.clientX, y: e.clientY };
      const rect = getDomRefs().canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (getDomRefs().canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (getDomRefs().canvas.height / rect.height);
      const worldX = (mouseX - gameState.mapOffsetX) / gameState.mapScale;
      const worldY = (mouseY - gameState.mapOffsetY) / gameState.mapScale;
      const { gx, gy } = snapToTileCenter(worldX, worldY);
      gameState.hoverGridX = gx;
      gameState.hoverGridY = gy;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (gameState.draggedTowerTypeId && e.button === 0) {
      const rect = getDomRefs().canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (getDomRefs().canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (getDomRefs().canvas.height / rect.height);
      const worldX = (mouseX - gameState.mapOffsetX) / gameState.mapScale;
      const worldY = (mouseY - gameState.mapOffsetY) / gameState.mapScale;
      const { gx, gy } = snapToTileCenter(worldX, worldY);
      handleBuild(gx, gy);
      gameState.draggedTowerTypeId = null;
      gameState.dragMousePos = null;
      gameState.hoverGridX = null;
      gameState.hoverGridY = null;
    }
  });

  // 監聽鍵盤事件以取消選取/工具
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      gameState.selectedTower = null;
      gameState.selectedTool = '';
      gameState.mergeMode = false;
      gameState.mergeFirstTower = null;
      if (gameState.refreshToolSelection) {
        gameState.refreshToolSelection();
      }
      updateCompassHighlight();
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      if (gameState.currentScene === 'BATTLE' && !gameState.isWaveActive) {
        const maxWaves = gameState.currentMap.id === 'tutorial' ? 5 : MAX_WAVES;
        if (gameState.currentMap.id === 'test_level' || gameState.wave < maxWaves) {
          e.preventDefault();
          playSFX('click');
          gameState.isWaveActive = true;
          gameState.wave++;
          if (gameState.spawnWave) {
            gameState.spawnWave(gameState.wave);
          }
          updateUI();
        }
      }
    }
    // 數字鍵 1-7 快捷選塔
    const numIndex = parseInt(e.key) - 1;
    if (gameState.currentScene === 'BATTLE' && numIndex >= 0 && numIndex < 7) {
      const tools = ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'];
      const tool = tools[numIndex];
      if (tool) {
        gameState.mergeMode = false;
        gameState.mergeFirstTower = null;
        gameState.selectedTool = tool;
        if (gameState.refreshToolSelection) {
          gameState.refreshToolSelection();
        }
        updateCompassHighlight();
      }
    }
    // S 鍵賣塔
    if (gameState.currentScene === 'BATTLE' && (e.key === 's' || e.key === 'S')) {
      if (gameState.hoverGridX !== null && gameState.hoverGridY !== null) {
        handleSell(gameState.hoverGridX, gameState.hoverGridY);
      }
    }
    // G 鍵切換加速
    if (gameState.currentScene === 'BATTLE' && (e.key === 'g' || e.key === 'G')) {
      playSFX('click');
      gameState.gameSpeed = gameState.gameSpeed === 1 ? 2 : gameState.gameSpeed === 2 ? 3 : 1;
      getDomRefs().btnSpeed.textContent = `⚡ ${gameState.gameSpeed}x`;
    }
  });

  // 新手教學關卡「我知道了」下一步按鈕事件
  const nextBtn = document.getElementById('btnLevelTutorialNext');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      playSFX('click');
      if (gameState.levelTutorialStep === 'intro') {
        gameState.levelTutorialStep = 'build_wall';
        // 自動幫玩家選中岩壁塔以方便點擊建造
        gameState.selectedTool = 'earth';
        gameState.mergeMode = false;
        if (gameState.refreshToolSelection) {
          gameState.refreshToolSelection();
        }
        updateCompassHighlight();
        updateUI();
      }
    });
  }
}

// 註冊 callback 到 gameState
gameState.resizeGameContainer = resizeGameContainer;
