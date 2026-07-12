// src/scenes/scenesManager.ts — 場景管理與基礎渲染

import { GameScene } from '../types';
import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { getAvailablePoints, TALENT_TREE, canUnlockTalent, unlockTalent, saveTalentData, TalentId } from '../talent';
import { MAPS, loadCustomMaps, deleteCustomMap } from '../maps';
import { playSFX } from '../audio/audioSystem';

let selectedTalentId: TalentId | null = null;

const talentIconMap: Record<TalentId, string> = {
  fortress_1: '盾', fortress_2: '城',
  gold_1: '金', gold_2: '財',
  precise_1: '準', precise_2: '刃', rapid_fire: '速',
  wood_awakening: '木', water_awakening: '水', fire_awakening: '火',
  earth_awakening: '土', metal_awakening: '金',
  yin_law: '陰', yang_law: '陽', taiji_dao: '☯',
  wall_discount: '壁'
};

function renderTalentDetail() {
  const nameEl = document.getElementById('talentDetailName');
  const iconEl = document.getElementById('talentDetailIcon');
  const levelEl = document.getElementById('talentDetailLevel');
  const descEl = document.getElementById('talentDetailDesc');
  const prereqEl = document.getElementById('talentDetailPrereq');
  const upgradeBtn = document.getElementById('btnUpgradeTalent') as HTMLButtonElement | null;
  if (!nameEl || !iconEl || !levelEl || !descEl || !prereqEl || !upgradeBtn) return;

  const node = selectedTalentId ? TALENT_TREE.find(t => t.id === selectedTalentId) : null;
  if (!node || !selectedTalentId) {
    nameEl.textContent = '選擇穴位';
    iconEl.textContent = '☯';
    levelEl.textContent = '經脈尚未選取';
    descEl.textContent = '選擇穴位查看效果與升級需求。';
    prereqEl.textContent = '';
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = '升級';
    upgradeBtn.onclick = null;
    return;
  }

  const level = gameState.talentData.talentLevels[selectedTalentId] || 0;
  const isMax = level >= node.maxLevel;
  const canUpgrade = canUnlockTalent(gameState.talentData, selectedTalentId);
  const unmet = node.prerequisites
    .filter(pid => (gameState.talentData.talentLevels[pid] || 0) < 1)
    .map(pid => TALENT_TREE.find(t => t.id === pid)?.name ?? pid);

  iconEl.textContent = talentIconMap[selectedTalentId] || '氣';
  iconEl.dataset.element = selectedTalentId.split('_')[0];
  nameEl.textContent = node.name;
  levelEl.textContent = `等級 ${level}/${node.maxLevel}`;
  descEl.textContent = node.description;
  prereqEl.textContent = unmet.length ? `需先開通：${unmet.join('、')}` : `升級消耗 ${node.cost} 點`;
  upgradeBtn.disabled = !canUpgrade || isMax;
  upgradeBtn.textContent = isMax ? '已圓滿' : `升級 ${node.cost} 點`;
  upgradeBtn.onclick = null;
  if (canUpgrade && !isMax) {
    upgradeBtn.onclick = () => {
      playSFX('click');
      unlockTalent(gameState.talentData, selectedTalentId!);
      renderTalentScreen();
    };
  }
}

export function switchScene(scene: GameScene) {
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
      if (gameState.animFrameId) {
        cancelAnimationFrame(gameState.animFrameId);
        gameState.animFrameId = null;
      }
      refreshMenuTalentInfo();
      break;
    case 'LEVEL_SELECT':
      getDomRefs().levelSelectScreenEl.classList.add('active');
      renderLevelSelectScreen();
      break;
    case 'MAP_EDITOR':
      getDomRefs().mapEditorSceneEl.classList.add('active');
      if (gameState.initEditor) {
        gameState.initEditor();
      }
      break;
    case 'TALENT_SCREEN':
      getDomRefs().talentScreenEl.classList.add('active');
      renderTalentScreen();
      break;
    case 'BATTLE':
      getDomRefs().battleSceneEl.classList.add('active');
      if (gameState.startBattle) {
        gameState.startBattle();
      }
      if (gameState.currentMap && gameState.currentMap.id === 'test_level') {
        gameState.mapScale = 1.0;
        gameState.mapOffsetX = 0;
        gameState.mapOffsetY = 0;
      } else {
        gameState.mapScale = 2.0; // 2x zoom for large maps
        gameState.mapOffsetX = 0; // Align left
        gameState.mapOffsetY = -320; // Center Y-axis vertically
      }
      if (gameState.resizeGameContainer) {
        gameState.resizeGameContainer();
      }
      break;
    case 'GAME_OVER':
      getDomRefs().gameOverScreenEl.classList.add('active');
      if (gameState.animFrameId) {
        cancelAnimationFrame(gameState.animFrameId);
        gameState.animFrameId = null;
      }
      break;
  }
}

export function refreshMenuTalentInfo() {
  const info = document.getElementById('menuTalentInfo');
  if (!info) return;
  const pts = getAvailablePoints(gameState.talentData);
  const total = gameState.talentData.totalTalentPoints;
  info.textContent = total > 0 ? `🌟 天賦點: ${pts} 可用 / ${total} 總計` : '尚未獲得天賦點';
}

export function renderLevelSelectScreen() {
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

export function renderTalentScreen() {
  document.getElementById('talentPointsVal')!.textContent = getAvailablePoints(gameState.talentData).toString();

  // 如果天賦引導活躍，強制鎖定基礎分支，防止切換中斷引導
  if (gameState.talentTutorialActive) {
    gameState.activeTalentTrack = 'track-base';
  }

  // 計算與更新天賦分支按鈕進度與 active 狀態
  const trackTalents: Record<string, string[]> = {
    'track-base': ['fortress_1', 'fortress_2', 'gold_1', 'gold_2'],
    'track-attack': ['precise_1', 'precise_2', 'rapid_fire'],
    'track-element': ['wood_awakening', 'water_awakening', 'fire_awakening', 'earth_awakening', 'wall_discount', 'metal_awakening'],
    'track-yinyang': ['yin_law', 'yang_law', 'taiji_dao']
  };

  const navBtns = document.querySelectorAll('.talent-nav-btn');
  navBtns.forEach(btn => {
    const trackId = btn.getAttribute('data-track');
    if (!trackId) return;

    const tids = trackTalents[trackId] || [];
    let currentLevelSum = 0;
    let maxLevelSum = 0;
    tids.forEach(tid => {
      const node = TALENT_TREE.find(t => t.id === tid);
      if (node) {
        currentLevelSum += gameState.talentData.talentLevels[tid as TalentId] || 0;
        maxLevelSum += node.maxLevel;
      }
    });

    let originalTitle = '';
    if (trackId === 'track-base') originalTitle = '基礎';
    else if (trackId === 'track-attack') originalTitle = '氣血';
    else if (trackId === 'track-element') originalTitle = '五行';
    else if (trackId === 'track-yinyang') originalTitle = '陰陽';

    btn.textContent = `${originalTitle} (${currentLevelSum}/${maxLevelSum})`;
    btn.classList.toggle('active', trackId === gameState.activeTalentTrack);
  });

  // 控制天賦分支面板的顯示與隱藏
  const tracks = document.querySelectorAll('.talent-track');
  tracks.forEach(track => {
    const htmlTrack = track as HTMLElement;
    if (htmlTrack.id === gameState.activeTalentTrack) {
      htmlTrack.style.display = 'flex';
    } else {
      htmlTrack.style.display = 'none';
    }
  });

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

    const icon = talentIconMap[tid] || '氣';

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
      <div class="talent-icon">${icon}</div>
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
    htmlEl.classList.toggle('selected', selectedTalentId === tid);
    htmlEl.onclick = () => {
      playSFX('click');
      selectedTalentId = tid;
      if (gameState.talentTutorialActive && canUpgrade && !isMax) {
        unlockTalent(gameState.talentData, tid);
        gameState.talentTutorialActive = false;
        gameState.talentData.hasPlayedBefore = true;
        saveTalentData(gameState.talentData);
        const bubble = document.getElementById('talentGuideBubble');
        if (bubble) bubble.remove();
      }
      renderTalentScreen();
    };
  });

  // 渲染引導氣泡
  const existingBubble = document.getElementById('talentGuideBubble');
  if (existingBubble) existingBubble.remove();

  if (gameState.talentTutorialActive) {
    const targetId = 'gold_1'; // 高亮初始資金 I
    const targetEl = document.querySelector(`[data-id="${targetId}"]`) as HTMLElement;
    if (targetEl) {
      targetEl.classList.add('guide-highlight');
      
      const bubble = document.createElement('div');
      bubble.id = 'talentGuideBubble';
      bubble.className = 'talent-guide-bubble';
      bubble.innerHTML = '🌟 點擊這裡解鎖你的第一個天賦「初始資金」，大幅增強局內開局優勢！';
      
      targetEl.appendChild(bubble);
    }
  }

  const activeTrack = document.getElementById(gameState.activeTalentTrack);
  if (!selectedTalentId || !activeTrack?.querySelector(`[data-id="${selectedTalentId}"]`)) {
    const visibleCard = activeTrack?.querySelector('.talent-card') as HTMLElement | null;
    selectedTalentId = visibleCard?.dataset.id as TalentId | null;
  }
  renderTalentDetail();

  // 延遲呼叫以保證佈局已完成
  setTimeout(drawTalentLines, 50);
}

function drawTalentLines() {
  const svg = document.getElementById('talentSvg') as any;
  if (!svg) return;
  svg.innerHTML = ''; // 清空舊的連線
  
  const container = document.querySelector('.talent-tree-container') as HTMLElement;
  if (!container) return;
  
  // 動態設定 SVG 尺寸為容器 of scroll 範圍，保證覆蓋
  const scrollWidth = container.scrollWidth;
  const scrollHeight = container.scrollHeight;
  svg.style.width = `${scrollWidth}px`;
  svg.style.height = `${scrollHeight}px`;
  
  const containerRect = container.getBoundingClientRect();
  
  // 連線對應定義
  const connections = [
    { from: 'fortress_1', to: 'fortress_2' },
    { from: 'gold_1', to: 'gold_2' },
    { from: 'precise_1', to: 'precise_2' },
    { from: 'precise_1', to: 'rapid_fire' },
    { from: 'earth_awakening', to: 'wall_discount' },
    { from: 'yin_law', to: 'taiji_dao' },
    { from: 'yang_law', to: 'taiji_dao' },
  ];

  // 輔助繪圖函式，用來畫出線條（包括背景流動與虛線）
  const drawSegment = (dPath: string, isActive: boolean) => {
    if (isActive) {
      const bgLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bgLine.setAttribute('d', dPath);
      bgLine.setAttribute('class', 'talent-bg-line active');
      svg.appendChild(bgLine);
      
      const flowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flowLine.setAttribute('d', dPath);
      flowLine.setAttribute('class', 'talent-flow-line');
      svg.appendChild(flowLine);
    } else {
      const lockedLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lockedLine.setAttribute('d', dPath);
      lockedLine.setAttribute('class', 'talent-locked-line');
      svg.appendChild(lockedLine);
    }
  };

  // 1. 先處理常規連線（排除 yin_law, yang_law 到 taiji_dao 的交叉連線）
  const regularConnections = connections.filter(
    c => !((c.from === 'yin_law' || c.from === 'yang_law') && c.to === 'taiji_dao')
  );

  regularConnections.forEach(({ from, to }) => {
    const fromEl = document.querySelector(`[data-id="${from}"]`);
    const toEl = document.querySelector(`[data-id="${to}"]`);
    if (!fromEl || !toEl) return;

    const rectFrom = fromEl.getBoundingClientRect();
    const rectTo = toEl.getBoundingClientRect();
    if (rectFrom.width === 0 || rectTo.width === 0) return;

    const x1 = rectFrom.right - containerRect.left;
    const y1 = rectFrom.top + rectFrom.height / 2 - containerRect.top;
    const x2 = rectTo.left - containerRect.left;
    const y2 = rectTo.top + rectTo.height / 2 - containerRect.top;

    const fromLvl = gameState.talentData.talentLevels[from as TalentId] || 0;
    const isActive = fromLvl >= 1;
    
    const controlOffset = Math.max(30, (x2 - x1) / 2);
    const d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    
    drawSegment(d, isActive);
  });

  // 2. 特殊處理 yin_law / yang_law 到 taiji_dao 的 Y 型分叉連線
  const yinEl = document.querySelector(`[data-id="yin_law"]`);
  const yangEl = document.querySelector(`[data-id="yang_law"]`);
  const taijiEl = document.querySelector(`[data-id="taiji_dao"]`);

  if (yinEl && yangEl && taijiEl) {
    const rectYin = yinEl.getBoundingClientRect();
    const rectYang = yangEl.getBoundingClientRect();
    const rectTaiji = taijiEl.getBoundingClientRect();
    if (rectYin.width === 0 || rectYang.width === 0 || rectTaiji.width === 0) return;

    const x1_yin = rectYin.right - containerRect.left;
    const y1_yin = rectYin.top + rectYin.height / 2 - containerRect.top;

    const x1_yang = rectYang.right - containerRect.left;
    const y1_yang = rectYang.top + rectYang.height / 2 - containerRect.top;

    const x2 = rectTaiji.left - containerRect.left;
    const y2 = rectTaiji.top + rectTaiji.height / 2 - containerRect.top;

    // 交匯點 M 坐標
    const mx = x1_yin + (x2 - x1_yin) * 0.4;
    const my = (y1_yin + y1_yang) / 2;

    const yinLvl = gameState.talentData.talentLevels['yin_law'] || 0;
    const yangLvl = gameState.talentData.talentLevels['yang_law'] || 0;

    const isYinActive = yinLvl >= 1;
    const isYangActive = yangLvl >= 1;
    const isMainActive = isYinActive && isYangActive; // 雙方皆解鎖，主幹才啟動為金色流光

    // 2.1 繪製 Yin 分支線
    const controlYin = Math.max(20, (mx - x1_yin) / 2);
    const dYin = `M ${x1_yin} ${y1_yin} C ${x1_yin + controlYin} ${y1_yin}, ${mx - controlYin} ${my}, ${mx} ${my}`;
    drawSegment(dYin, isYinActive);

    // 2.2 繪製 Yang 分支線
    const controlYang = Math.max(20, (mx - x1_yang) / 2);
    const dYang = `M ${x1_yang} ${y1_yang} C ${x1_yang + controlYang} ${y1_yang}, ${mx - controlYang} ${my}, ${mx} ${my}`;
    drawSegment(dYang, isYangActive);

    // 2.3 繪製主幹部分
    const controlMain = Math.max(20, (x2 - mx) / 2);
    const dMain = `M ${mx} ${my} C ${mx + controlMain} ${my}, ${x2 - controlMain} ${y2}, ${x2} ${y2}`;
    drawSegment(dMain, isMainActive);
  }
}

// 註冊至 gameState 以供全域呼叫
gameState.switchScene = switchScene;
gameState.renderTalentScreen = renderTalentScreen;
gameState.renderLevelSelectScreen = renderLevelSelectScreen;
gameState.refreshMenuTalentInfo = refreshMenuTalentInfo;
