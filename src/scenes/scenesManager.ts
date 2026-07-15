// src/scenes/scenesManager.ts — 場景管理與基礎渲染

import { GameScene } from '../types';
import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import {
  getAvailablePoints,
  TALENT_TREE,
  TALENT_TRACK_TALENTS,
  TALENT_TRACK_UNLOCK_POINTS,
  canUnlockTalent,
  isTalentTrackUnlocked,
  unlockTalent,
  saveTalentData,
  TalentId,
  type TalentTrackId
} from '../talent';
import { MAPS, loadCustomMaps, deleteCustomMap } from '../maps';
import { playSFX } from '../audio/audioSystem';
import {
  TALENT_CONNECTIONS,
  TALENT_OUTER_SEALS,
  buildTalentConnectionCurve,
  getTalentConnectionState,
  isTalentOuterSealId,
  type TalentConnectionDefinition,
  type TalentConnectionState,
  type TalentSealMotif,
} from '../ui/talentConnections';

let selectedTalentId: TalentId | null = null;
let talentLineFrame: number | null = null;
let talentResizeObserver: ResizeObserver | null = null;
let observedTalentContainer: HTMLElement | null = null;

interface TalentNodeLayout {
  x: number;
  y: number;
  rotation: number;
  figure: 'front' | 'back' | 'center';
}

/**
 * 以圖譜百分比定位品像，避免將像素座標綁死在單一解析度。
 * 正面人物約位於 x=26%，背面人物約位於 x=73%，中央留給氣機與太極匯流。
 */
const TALENT_NODE_LAYOUT: Record<TalentId, TalentNodeLayout> = {
  fortress_1: { x: 61, y: 66, rotation: -2, figure: 'back' },
  fortress_2: { x: 84, y: 30, rotation: 2, figure: 'back' },
  gold_1: { x: 12, y: 66, rotation: -3, figure: 'front' },
  gold_2: { x: 40, y: 45, rotation: 2, figure: 'front' },
  precise_1: { x: 13, y: 22, rotation: -2, figure: 'front' },
  precise_2: { x: 41, y: 18, rotation: 3, figure: 'front' },
  rapid_fire: { x: 43, y: 49, rotation: -1, figure: 'center' },
  wood_awakening: { x: 10, y: 42, rotation: -3, figure: 'front' },
  fire_awakening: { x: 39, y: 29, rotation: 2, figure: 'front' },
  earth_awakening: { x: 41, y: 55, rotation: -1, figure: 'front' },
  wall_discount: { x: 49, y: 77, rotation: 3, figure: 'center' },
  metal_awakening: { x: 60, y: 24, rotation: -2, figure: 'center' },
  water_awakening: { x: 12, y: 75, rotation: 2, figure: 'front' },
  yin_law: { x: 13, y: 66, rotation: -3, figure: 'front' },
  yang_law: { x: 87, y: 66, rotation: 3, figure: 'back' },
  taiji_dao: { x: 50, y: 58, rotation: 0, figure: 'center' }
};

const TRACK_GUIDE: Record<TalentTrackId, { stage: string; title: string; plainLabel: string; requiredPoints: number; story: string }> = {
  'track-base': {
    stage: '第一境', title: '任督築基', plainLabel: '基礎', requiredPoints: TALENT_TRACK_UNLOCK_POINTS['track-base'],
    story: '任督二脈是修行起點：先增加基地生命或開局金幣，建立每一局都用得到的根基。'
  },
  'track-attack': {
    stage: '第二境', title: '氣機初行', plainLabel: '氣血', requiredPoints: TALENT_TRACK_UNLOCK_POINTS['track-attack'],
    story: '氣血貫通後可強化所有砲台：精準提高傷害，急速縮短攻擊冷卻。'
  },
  'track-element': {
    stage: '第三境', title: '五藏應象', plainLabel: '五行', requiredPoints: TALENT_TRACK_UNLOCK_POINTS['track-element'],
    story: '五臟各應一行：肝木主控制、心火主爆發、脾土主築防、肺金主鋒銳、腎水主遲滯。'
  },
  'track-yinyang': {
    stage: '第四境', title: '陰陽合化', plainLabel: '陰陽', requiredPoints: TALENT_TRACK_UNLOCK_POINTS['track-yinyang'],
    story: '陰陽是後期修行：先分別掌握暗影與聖光，最後匯流為太極合成之道。'
  }
};

const TALENT_MOTIF_BY_ID: Record<TalentId, TalentSealMotif> = {
  fortress_1: 'fortress', fortress_2: 'wall',
  gold_1: 'wealth', gold_2: 'wealth',
  precise_1: 'precision', precise_2: 'blade', rapid_fire: 'flow',
  wood_awakening: 'wood', water_awakening: 'water', fire_awakening: 'fire',
  earth_awakening: 'earth', metal_awakening: 'metal',
  yin_law: 'yin', yang_law: 'yang', taiji_dao: 'taiji',
  wall_discount: 'wall',
};

function createTalentSealArt(motif: TalentSealMotif, className: string): SVGSVGElement | null {
  if (typeof document.createElementNS !== 'function') return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  ring.setAttribute('href', '#talent-bronze-cloud-ring');
  ring.setAttribute('class', 'talent-bronze-ring-art');

  const emblem = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  emblem.setAttribute('href', `#talent-motif-${motif}`);
  emblem.setAttribute('class', 'talent-bronze-motif-art');
  svg.append(ring, emblem);
  return svg;
}

function replaceTalentSealArt(container: HTMLElement, motif: TalentSealMotif, className: string): void {
  const art = createTalentSealArt(motif, className);
  if (art && typeof container.replaceChildren === 'function') {
    container.replaceChildren(art);
    return;
  }
  container.textContent = '';
}

function renderTalentDetail() {
  const panelEl = document.getElementById('talentDetailPanel');
  const nameEl = document.getElementById('talentDetailName');
  const iconEl = document.getElementById('talentDetailIcon');
  const mechanicEl = document.getElementById('talentDetailMechanic');
  const levelEl = document.getElementById('talentDetailLevel');
  const descEl = document.getElementById('talentDetailDesc');
  const prereqEl = document.getElementById('talentDetailPrereq');
  const loreEl = document.getElementById('talentDetailLore');
  const sourceEl = document.getElementById('talentDetailSource');
  const upgradeBtn = document.getElementById('btnUpgradeTalent') as HTMLButtonElement | null;
  if (!panelEl || !nameEl || !iconEl || !mechanicEl || !levelEl || !descEl || !prereqEl || !loreEl || !sourceEl || !upgradeBtn) return;

  const node = selectedTalentId ? TALENT_TREE.find(t => t.id === selectedTalentId) : null;
  if (!node || !selectedTalentId) {
    panelEl.dataset.theme = 'taiji';
    panelEl.dataset.state = 'idle';
    iconEl.dataset.theme = 'taiji';
    mechanicEl.textContent = '選擇節點後顯示機制副標';
    sourceEl.textContent = '取意來源會顯示於此';
    nameEl.textContent = '選擇天賦印';
    replaceTalentSealArt(iconEl, 'taiji', 'talent-detail-seal-art');
    levelEl.textContent = '經脈尚未選取';
    loreEl.textContent = '每枚天賦印代表一條戰鬥修行路線；圖中位置只作藏象幻想取意。';
    descEl.textContent = '選擇修習節點查看效果與升級需求。';
    prereqEl.textContent = '';
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = '升級';
    upgradeBtn.onclick = null;
    return;
  }

  const level = gameState.talentData.talentLevels[selectedTalentId] || 0;
  const isMax = level >= node.maxLevel;
  const canUpgrade = canUnlockTalent(gameState.talentData, selectedTalentId);
  const availablePoints = getAvailablePoints(gameState.talentData);
  const unmet = node.prerequisites
    .filter(pid => (gameState.talentData.talentLevels[pid] || 0) < 1)
    .map(pid => TALENT_TREE.find(t => t.id === pid)?.displayName ?? pid);

  replaceTalentSealArt(iconEl, TALENT_MOTIF_BY_ID[selectedTalentId], 'talent-detail-seal-art');
  iconEl.dataset.theme = node.visualTheme;
  nameEl.textContent = node.displayName;
  mechanicEl.textContent = node.mechanicLabel;
  levelEl.textContent = `等級 ${level}/${node.maxLevel}${isMax ? '・圓滿' : level === 0 ? '・未啟' : '・行氣中'}`;
  loreEl.textContent = node.classicAllusion;
  sourceEl.textContent = `取意：${node.sourceRef}`;
  descEl.textContent = node.description;
  panelEl.dataset.theme = node.visualTheme;
  panelEl.dataset.state = isMax ? 'maxed' : level > 0 ? 'unlocked' : canUpgrade ? 'available' : 'locked';
  prereqEl.textContent = isMax
    ? '此印已修至圓滿'
    : unmet.length
      ? `需先開通：${unmet.join('、')}`
      : availablePoints < node.cost
        ? `天賦點不足：需 ${node.cost} 點，目前 ${availablePoints} 點`
        : `升級消耗 ${node.cost} 點`;
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

function selectTalentCard(card: HTMLElement): void {
  const talentId = card.dataset.id as TalentId | undefined;
  if (!talentId) return;

  selectedTalentId = talentId;
  const activeTrack = document.getElementById(gameState.activeTalentTrack);
  activeTrack?.querySelectorAll<HTMLElement>('.talent-card').forEach(candidate => {
    const selected = candidate === card;
    candidate.classList.toggle('selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
  });
  renderTalentDetail();
  scheduleTalentLines();
}

type SpatialDirection = 'left' | 'right' | 'up' | 'down';

function findSpatialTalentCard(cards: HTMLElement[], current: HTMLElement, direction: SpatialDirection): HTMLElement | null {
  const currentRect = current.getBoundingClientRect();
  const currentX = currentRect.left + currentRect.width / 2;
  const currentY = currentRect.top + currentRect.height / 2;

  let best: { card: HTMLElement; score: number } | null = null;
  for (const candidate of cards) {
    if (candidate === current) continue;
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - currentX;
    const dy = rect.top + rect.height / 2 - currentY;
    const inDirection = direction === 'left' ? dx < -1
      : direction === 'right' ? dx > 1
        : direction === 'up' ? dy < -1
          : dy > 1;
    if (!inDirection) continue;

    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 0.55;
    if (!best || score < best.score) best = { card: candidate, score };
  }
  return best?.card ?? null;
}

function handleTalentCardKeydown(event: KeyboardEvent, card: HTMLElement): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    card.click();
    return;
  }

  const activeTrack = document.getElementById(gameState.activeTalentTrack);
  const cards = Array.from(activeTrack?.querySelectorAll<HTMLElement>('.talent-card') ?? []);
  const currentIndex = cards.indexOf(card);
  if (currentIndex < 0) return;

  let nextCard: HTMLElement | null = null;
  if (event.key === 'ArrowRight') nextCard = findSpatialTalentCard(cards, card, 'right');
  if (event.key === 'ArrowDown') nextCard = findSpatialTalentCard(cards, card, 'down');
  if (event.key === 'ArrowLeft') nextCard = findSpatialTalentCard(cards, card, 'left');
  if (event.key === 'ArrowUp') nextCard = findSpatialTalentCard(cards, card, 'up');
  if (event.key === 'Home') nextCard = cards[0] ?? null;
  if (event.key === 'End') nextCard = cards[cards.length - 1] ?? null;
  if (!nextCard) return;

  event.preventDefault();
  selectTalentCard(nextCard);
  nextCard.focus();
}

export function switchScene(scene: GameScene) {
  if (scene !== 'TALENT_SCREEN') stopTalentLineObservation();
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
      if (gameState.currentMap?.dimensions?.overview) {
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
  // 若天賦教學引導活躍，且可用點數小於引導解鎖所需的 2 點，則防禦性補齊，防止卡死
  if (gameState.talentTutorialActive) {
    const available = getAvailablePoints(gameState.talentData);
    if (available < 2) {
      gameState.talentData.totalTalentPoints += (2 - available);
      saveTalentData(gameState.talentData);
    }
  }

  document.getElementById('talentPointsVal')!.textContent = getAvailablePoints(gameState.talentData).toString();

  // 如果天賦引導活躍，強制鎖定基礎分支，防止切換中斷引導
  if (gameState.talentTutorialActive) {
    gameState.activeTalentTrack = 'track-base';
  }

  // 既有存檔若已投資某分支，該分支永遠保持開放；重置只退點、不倒退敘事進度。
  if (!isTalentTrackUnlocked(gameState.talentData, gameState.activeTalentTrack)) {
    gameState.activeTalentTrack = 'track-base';
  }

  const navBtns = document.querySelectorAll('.talent-nav-btn');
  navBtns.forEach(btn => {
    const trackId = btn.getAttribute('data-track') as TalentTrackId | null;
    if (!trackId) return;

    const tids = TALENT_TRACK_TALENTS[trackId];
    let currentLevelSum = 0;
    let maxLevelSum = 0;
    tids.forEach(tid => {
      const node = TALENT_TREE.find(t => t.id === tid);
      if (node) {
        currentLevelSum += gameState.talentData.talentLevels[tid as TalentId] || 0;
        maxLevelSum += node.maxLevel;
      }
    });

    const trackUnlocked = isTalentTrackUnlocked(gameState.talentData, trackId);
    const navButton = btn as HTMLButtonElement;
    navButton.disabled = !trackUnlocked || gameState.talentTutorialActive && trackId !== 'track-base';
    navButton.classList.toggle('track-locked', !trackUnlocked);
    navButton.title = trackUnlocked
      ? TRACK_GUIDE[trackId].story
      : `累積 ${TRACK_GUIDE[trackId].requiredPoints} 點天賦後開放`;
    const guide = TRACK_GUIDE[trackId];
    const tabMeta = trackUnlocked
      ? `${guide.plainLabel}・${currentLevelSum}/${maxLevelSum}`
      : `${guide.plainLabel}・累積 ${guide.requiredPoints} 點開放`;
    btn.innerHTML = `
      <span class="talent-tab-stage">${guide.stage}</span>
      <span class="talent-tab-name">${guide.title}</span>
      <span class="talent-tab-meta">${trackUnlocked ? '' : '🔒 '}${tabMeta}</span>
    `;
    const active = trackId === gameState.activeTalentTrack;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
    btn.setAttribute('aria-disabled', String(!trackUnlocked));
    navButton.tabIndex = active ? 0 : -1;
  });

  const storyGuide = document.getElementById('talentStoryGuide');
  if (storyGuide) {
    const activeGuide = TRACK_GUIDE[gameState.activeTalentTrack];
    const nextLocked = (Object.keys(TRACK_GUIDE) as TalentTrackId[])
      .find(trackId => !isTalentTrackUnlocked(gameState.talentData, trackId));
    const nextHint = nextLocked
      ? ` 下一階段「${TRACK_GUIDE[nextLocked].title}」會在累積 ${TRACK_GUIDE[nextLocked].requiredPoints} 點後開放。`
      : ' 四脈皆已開放，可依本局常用塔系自由修行。';
    storyGuide.textContent = `${activeGuide.story}${nextHint}`;
  }

  // 控制天賦分支面板的顯示與隱藏
  const tracks = document.querySelectorAll('.talent-track');
  tracks.forEach(track => {
    const htmlTrack = track as HTMLElement;
    const active = htmlTrack.id === gameState.activeTalentTrack;
    htmlTrack.setAttribute('aria-hidden', String(!active));
    if (active) {
      htmlTrack.style.display = 'flex';
    } else {
      htmlTrack.style.display = 'none';
    }
  });

  const activeTrack = document.getElementById(gameState.activeTalentTrack);
  if (!selectedTalentId || !activeTrack?.querySelector(`[data-id="${selectedTalentId}"]`)) {
    const visibleCard = activeTrack?.querySelector('.talent-card') as HTMLElement | null;
    selectedTalentId = visibleCard?.dataset.id as TalentId | null;
  }

  renderTalentOuterSeals();

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

    const statusMark = isMax ? '成' : level > 0 ? '啟' : canUpgrade ? '可' : '封';
    const layout = TALENT_NODE_LAYOUT[tid];

    cardEl.innerHTML = `
      <span class="talent-seal" aria-hidden="true"></span>
      <span class="talent-node-copy">
        <span class="talent-card-title">${node.displayName}</span>
        <span class="talent-card-level">${node.organ ? `${node.organ}藏・` : ''}Lv.${level}/${node.maxLevel}</span>
      </span>
      <span class="talent-state-mark" aria-hidden="true">${statusMark}</span>
    `;

    const sealArt = createTalentSealArt(TALENT_MOTIF_BY_ID[tid], 'talent-seal-art');
    if (sealArt) cardEl.querySelector('.talent-seal')?.appendChild(sealArt);

    // 重設並重新綁定點擊事件
    const htmlEl = cardEl as HTMLElement;
    const selected = selectedTalentId === tid;
    const domState = isMax ? 'maxed' : level > 0 ? 'unlocked' : canUpgrade ? 'available' : 'locked';
    htmlEl.dataset.theme = node.visualTheme;
    htmlEl.dataset.state = domState;
    htmlEl.dataset.figure = layout.figure;
    htmlEl.dataset.tier = tid === 'taiji_dao' ? 'core' : node.prerequisites.length > 0 ? 'branch' : 'outer';
    htmlEl.style.setProperty('--node-x', `${layout.x}%`);
    htmlEl.style.setProperty('--node-y', `${layout.y}%`);
    htmlEl.style.setProperty('--node-rotation', `${layout.rotation}deg`);
    htmlEl.removeAttribute('role');
    htmlEl.removeAttribute('aria-selected');
    htmlEl.setAttribute('aria-pressed', String(selected));
    htmlEl.setAttribute('aria-controls', 'talentDetailPanel');
    htmlEl.setAttribute('aria-label', `${node.displayName}，${node.mechanicLabel}，等級 ${level}/${node.maxLevel}，${domState === 'maxed' ? '已滿級' : domState === 'unlocked' ? '已解鎖' : domState === 'available' ? `可學習，花費 ${node.cost} 點` : '尚未可學習'}`);
    htmlEl.title = `${node.displayName}｜${node.mechanicLabel}`;
    htmlEl.tabIndex = selected ? 0 : -1;
    htmlEl.onclick = null;
    htmlEl.onkeydown = null;
    htmlEl.classList.toggle('selected', selected);
    htmlEl.onclick = () => {
      playSFX('click');
      selectTalentCard(htmlEl);
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
    htmlEl.onkeydown = event => handleTalentCardKeydown(event, htmlEl);
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

  renderTalentDetail();
  bindTalentAtlasAsset();
  observeTalentLayout();
  scheduleTalentLines();
}

function scheduleTalentLines(): void {
  if (typeof requestAnimationFrame === 'undefined') return;
  if (talentLineFrame !== null) return;
  talentLineFrame = requestAnimationFrame(() => {
    talentLineFrame = null;
    drawTalentLines();
  });
}

function observeTalentLayout(): void {
  if (typeof ResizeObserver === 'undefined') return;
  const container = document.querySelector('.talent-tree-container') as HTMLElement | null;
  if (!container || observedTalentContainer === container) return;

  talentResizeObserver?.disconnect();
  talentResizeObserver = new ResizeObserver(scheduleTalentLines);
  talentResizeObserver.observe(container);
  observedTalentContainer = container;
}

function stopTalentLineObservation(): void {
  talentResizeObserver?.disconnect();
  talentResizeObserver = null;
  observedTalentContainer = null;
  if (talentLineFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(talentLineFrame);
    talentLineFrame = null;
  }
}

function renderTalentOuterSeals(): void {
  const field = document.getElementById('talentOuterSeals');
  if (!field || typeof document.createDocumentFragment !== 'function' || typeof field.replaceChildren !== 'function') return;

  const fragment = document.createDocumentFragment();
  TALENT_OUTER_SEALS.forEach(seal => {
    const marker = document.createElement('span');
    marker.className = 'talent-outer-seal';
    marker.dataset.outerId = seal.id;
    marker.dataset.theme = seal.theme;
    marker.dataset.state = 'locked';
    marker.setAttribute('role', 'note');
    marker.setAttribute('aria-label', `${seal.label}，未開放章節`);
    marker.title = `${seal.label}｜未開放章節`;

    const label = document.createElement('span');
    label.className = 'talent-outer-seal-label';
    label.textContent = '外章未開';

    const art = createTalentSealArt(seal.motif, 'talent-outer-seal-art');
    if (art) marker.append(art, label);
    else marker.appendChild(label);
    fragment.appendChild(marker);
  });
  field.replaceChildren(fragment);
}

function bindTalentAtlasAsset(): void {
  const image = document.getElementById('talentAtlasArt') as HTMLImageElement | null;
  const container = document.querySelector('.meridian-bg-container');
  if (!image || !container) return;

  const showArtwork = () => {
    image.hidden = false;
    container.classList.add('asset-loaded');
    container.classList.remove('asset-fallback');
    scheduleTalentLines();
  };
  const showFallback = () => {
    image.hidden = true;
    container.classList.remove('asset-loaded');
    container.classList.add('asset-fallback');
    scheduleTalentLines();
  };

  if (image.dataset.fallbackBound !== 'true') {
    image.dataset.fallbackBound = 'true';
    image.onload = showArtwork;
    image.onerror = showFallback;
  }

  if (image.complete) {
    if (image.naturalWidth > 0) showArtwork();
    else showFallback();
  }
}

function drawTalentLines(): void {
  const svg = document.getElementById('talentSvg') as SVGSVGElement | null;
  if (!svg) return;
  svg.replaceChildren();
  
  const container = document.querySelector('.talent-tree-container') as HTMLElement;
  if (!container) return;
  
  // 動態設定 SVG 尺寸為容器 of scroll 範圍，保證覆蓋
  const scrollWidth = container.scrollWidth;
  const scrollHeight = container.scrollHeight;
  svg.style.width = `${scrollWidth}px`;
  svg.style.height = `${scrollHeight}px`;
  
  const containerRect = container.getBoundingClientRect();
  
  const createPath = (dPath: string, className: string): SVGPathElement => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dPath);
    path.setAttribute('class', className);
    return path;
  };

  const drawConnection = (
    dPath: string,
    connection: TalentConnectionDefinition,
    state: TalentConnectionState,
  ): void => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'talent-line-group');
    group.dataset.from = connection.from;
    group.dataset.to = connection.to;
    group.dataset.theme = connection.theme;
    group.dataset.state = state;
    group.dataset.kind = connection.kind;
    if (selectedTalentId === connection.from || selectedTalentId === connection.to) {
      group.dataset.selected = 'true';
    }

    group.append(
      createPath(dPath, 'talent-line-halo'),
      createPath(dPath, 'talent-line-ink'),
    );
    if (state === 'active') group.appendChild(createPath(dPath, 'talent-line-flow'));
    if (state === 'maxed') group.appendChild(createPath(dPath, 'talent-line-completion'));
    svg.appendChild(group);
  };

  TALENT_CONNECTIONS.forEach(connection => {
    const fromEl = document.querySelector(`[data-id="${connection.from}"]`);
    const toSelector = isTalentOuterSealId(connection.to)
      ? `[data-outer-id="${connection.to}"]`
      : `[data-id="${connection.to}"]`;
    const toEl = document.querySelector(toSelector);
    if (!fromEl || !toEl) return;

    const rectFrom = fromEl.getBoundingClientRect();
    const rectTo = toEl.getBoundingClientRect();
    if (rectFrom.width === 0 || rectTo.width === 0) return;

    const from = {
      x: rectFrom.left + rectFrom.width / 2 - containerRect.left,
      y: rectFrom.top + rectFrom.height / 2 - containerRect.top,
    };
    const to = {
      x: rectTo.left + rectTo.width / 2 - containerRect.left,
      y: rectTo.top + rectTo.height / 2 - containerRect.top,
    };
    const d = buildTalentConnectionCurve(from, to);

    const state = getTalentConnectionState(gameState.talentData, connection);
    drawConnection(d, connection, state);
  });
}

// 註冊至 gameState 以供全域呼叫
gameState.switchScene = switchScene;
gameState.renderTalentScreen = renderTalentScreen;
gameState.renderLevelSelectScreen = renderLevelSelectScreen;
gameState.refreshMenuTalentInfo = refreshMenuTalentInfo;
