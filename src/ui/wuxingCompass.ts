// src/ui/wuxingCompass.ts — 五行羅盤 HUD 交互邏輯
import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { ELEMENT_COUNTER } from '../towers';
import { getElementAccent } from '../theme';

// 注入發光動畫 CSS
function injectCompassStyles() {
  if (document.getElementById('wuxingCompassStyles')) return;
  const style = document.createElement('style');
  style.id = 'wuxingCompassStyles';
  style.textContent = `
    @keyframes compassGlow {
      0%, 100% { filter: none; stroke-width: 1.0; }
      50% { filter: drop-shadow(0 0 5px #ef4444); stroke-width: 2.5; stroke: #fca5a5; }
    }
    .compass-glow-active {
      animation: compassGlow 0.4s ease 2;
    }
    .compass-vertex-highlight {
      r: 9 !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 0 6px var(--glow-color, #fff)) !important;
    }
  `;
  document.head.appendChild(style);
}

export function initWuxingCompass() {
  injectCompassStyles();
  const compassEl = getDomRefs().wuxingCompass;

  // 點擊切換摺疊 / 展開
  compassEl.addEventListener('click', () => {
    // 阻止如果點擊到 SVG 內部元素導致的其他意外觸發
    compassEl.classList.toggle('compact');
  });

  // 初始化所有頂點元素
  const circles = compassEl.querySelectorAll('circle');
  circles.forEach(c => {
    c.style.transition = 'all 0.25s ease';
  });
}

/** 觸發特定克制關係的箭頭閃爍 (例如 fire 攻擊 metal 怪物) */
export function triggerCounterGlow(towerEl: string, enemyEl: string) {
  const compassEl = getDomRefs().wuxingCompass;
  if (compassEl.classList.contains('compact')) return; // 收合時不閃爍以免有效能開銷

  const pathId = `cnt-${towerEl}-${enemyEl}`;
  const path = compassEl.querySelector(`#${pathId}`);
  if (path) {
    path.classList.remove('compass-glow-active');
    // 強制重繪以重啟 CSS 動畫
    void (path as any).offsetWidth;
    path.classList.add('compass-glow-active');
    setTimeout(() => {
      path.classList.remove('compass-glow-active');
    }, 800);
  }
}

/** 根據懸停砲台按鈕或被選中砲台的屬性，高亮羅盤中對應關係 */
export function updateCompassHighlight() {
  const compassEl = getDomRefs().wuxingCompass;
  if (compassEl.classList.contains('compact')) return;

  const activeElement = gameState.hoveredTowerBtn || (gameState.selectedTower ? gameState.selectedTower.def.element : null) || (gameState.selectedTool !== 'sell' && gameState.selectedTool !== 'earth' && gameState.selectedTool !== 'merge' ? gameState.selectedTool : null);

  // 重置所有圓圈高亮
  const circles = compassEl.querySelectorAll('circle');
  circles.forEach((c: any) => {
    c.classList.remove('compass-vertex-highlight');
    c.style.removeProperty('--glow-color');
  });

  // 重置相剋路徑粗細
  const paths = compassEl.querySelectorAll('path[id^="cnt-"]');
  paths.forEach((p: any) => {
    p.style.strokeWidth = '1.0';
    p.style.stroke = '#ef4444';
  });

  if (!activeElement || activeElement === 'yin' || activeElement === 'yang') return;

  // 尋找克制目標
  const counteredElement = ELEMENT_COUNTER[activeElement];

  // 1. 高亮攻擊屬性頂點

  const vertexIndex: Record<string, number> = { wood: 0, fire: 1, earth: 2, metal: 3, water: 4 };
  
  if (vertexIndex[activeElement] !== undefined) {
    const activeCircle = circles[vertexIndex[activeElement]] as any;
    if (activeCircle) {
      activeCircle.classList.add('compass-vertex-highlight');
      activeCircle.style.setProperty('--glow-color', getElementAccent(activeElement));
    }
  }

  // 2. 高亮防禦屬性頂點 (被克制)
  if (counteredElement && vertexIndex[counteredElement] !== undefined) {
    const targetCircle = circles[vertexIndex[counteredElement]] as any;
    if (targetCircle) {
      targetCircle.classList.add('compass-vertex-highlight');
      targetCircle.style.setProperty('--glow-color', getElementAccent(counteredElement));
    }

    // 3. 高亮相剋箭頭
    const pathId = `cnt-${activeElement}-${counteredElement}`;
    const path = compassEl.querySelector(`#${pathId}`) as any;
    if (path) {
      path.style.strokeWidth = '2.5';
      path.style.stroke = '#fbbf24'; // 改為金色高亮
    }
  }
}
