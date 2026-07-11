// ============================================================
// src/system/roguelikeSystem.ts — Roguelike 增益卡牌系統
// ============================================================
//
// 三大機制：
//   1. 波間三選一卡牌 (Wave End Card Picker)
//   2. 起始隨機補給 (Start Bonus)
//   3. 神秘召喚 (Mystery Summon)

import { gameState } from '../state';
import { BASE_TOWERS, TowerTypeId } from '../towers';
import { isTowerUnlocked } from '../talent';
import { showFloat } from '../renderer/gameRenderer';
import { updateUI } from '../ui/uiManager';
import { playSFX } from '../audio/audioSystem';

// ============================================================
// 卡牌定義
// ============================================================

export type CardCategory = 'element_blessing' | 'resource' | 'tower' | 'resonance';

export interface RogueCard {
  id: string;
  category: CardCategory;
  title: string;
  description: string;
  emoji: string;
  accentColor: string;
  effect: () => void;
}

/** 建立完整的 16 張卡牌池 */
function buildCardPool(): RogueCard[] {
  return [
    // ── 元素祝福類 (7 張) ──
    {
      id: 'blessing_fire',
      category: 'element_blessing',
      title: '火之祝福',
      description: '本局火系塔傷害 +20%（最多疊 2 層）',
      emoji: '🔥',
      accentColor: '#ef4444',
      effect: () => applyElementBlessingBuff('fire', 0.2),
    },
    {
      id: 'blessing_water',
      category: 'element_blessing',
      title: '水之祝福',
      description: '本局水系塔傷害 +20%（最多疊 2 層）',
      emoji: '💧',
      accentColor: '#38bdf8',
      effect: () => applyElementBlessingBuff('water', 0.2),
    },
    {
      id: 'blessing_wood',
      category: 'element_blessing',
      title: '木之祝福',
      description: '本局木系塔傷害 +20%（最多疊 2 層）',
      emoji: '🌿',
      accentColor: '#22c55e',
      effect: () => applyElementBlessingBuff('wood', 0.2),
    },
    {
      id: 'blessing_earth',
      category: 'element_blessing',
      title: '土之祝福',
      description: '本局土系塔傷害 +20%（最多疊 2 層）',
      emoji: '🗿',
      accentColor: '#fbbf24',
      effect: () => applyElementBlessingBuff('earth', 0.2),
    },
    {
      id: 'blessing_metal',
      category: 'element_blessing',
      title: '金之祝福',
      description: '本局金系塔傷害 +20%（最多疊 2 層）',
      emoji: '⚙️',
      accentColor: '#cbd5e1',
      effect: () => applyElementBlessingBuff('metal', 0.2),
    },
    {
      id: 'blessing_yin',
      category: 'element_blessing',
      title: '陰之祝福',
      description: '本局陰系塔傷害 +20%（最多疊 2 層）',
      emoji: '🌑',
      accentColor: '#c084fc',
      effect: () => applyElementBlessingBuff('yin', 0.2),
    },
    {
      id: 'blessing_yang',
      category: 'element_blessing',
      title: '陽之祝福',
      description: '本局陽系塔傷害 +20%（最多疊 2 層）',
      emoji: '☀️',
      accentColor: '#fde047',
      effect: () => applyElementBlessingBuff('yang', 0.2),
    },

    // ── 資源類 (3 張) ──
    {
      id: 'resource_gold',
      category: 'resource',
      title: '金幣雨',
      description: '立即獲得 30 金幣',
      emoji: '🪙',
      accentColor: '#f59e0b',
      effect: () => {
        gameState.gold += 30;
        showFloat(640, 300, '金幣雨 +30g！', '#f59e0b', 18);
        updateUI();
      },
    },
    {
      id: 'resource_hp',
      category: 'resource',
      title: '絕地補給',
      description: '立即恢復 2 點基地生命',
      emoji: '💚',
      accentColor: '#4ade80',
      effect: () => {
        const maxHp = gameState.hp + 2; // 允許超過初始上限 2 點
        gameState.hp = Math.min(maxHp, gameState.hp + 2);
        showFloat(640, 300, '絕地補給 +2 HP！', '#4ade80', 18);
        updateUI();
      },
    },
    {
      id: 'resource_free_build',
      category: 'resource',
      title: '全能工匠',
      description: '下一次建塔完全免費',
      emoji: '🔨',
      accentColor: '#fbbf24',
      effect: () => {
        gameState.roguelikeState.freeNextBuild = true;
        showFloat(640, 300, '全能工匠！下次建塔免費！', '#fbbf24', 18);
        updateUI();
      },
    },

    // ── 塔類 (2 張) ──
    {
      id: 'tower_random',
      category: 'tower',
      title: '隨機補給',
      description: '隨機獲得一座已解鎖 Lv1 塔（直接選取，點格子放置）',
      emoji: '🎁',
      accentColor: '#a78bfa',
      effect: () => grantRandomTower(),
    },
    {
      id: 'tower_random_2',
      category: 'tower',
      title: '雙重補給',
      description: '隨機獲得兩座已解鎖 Lv1 塔（逐次選取放置）',
      emoji: '🎀',
      accentColor: '#f472b6',
      effect: () => {
        grantRandomTower();
        // 延遲 500ms 再選下一座，避免狀態衝突
        setTimeout(() => grantRandomTower(), 500);
      },
    },

    // ── 五行共鳴類 (4 張) ──
    {
      id: 'resonance_merge_discount',
      category: 'resonance',
      title: '五行共鳴',
      description: '下一次合成費用減少 50%',
      emoji: '☯️',
      accentColor: '#818cf8',
      effect: () => {
        gameState.roguelikeState.nextMergeCostPct = 0.5;
        showFloat(640, 300, '五行共鳴！下次合成費 -50%！', '#818cf8', 18);
        updateUI();
      },
    },
    {
      id: 'resonance_range',
      category: 'resonance',
      title: '萬象射界',
      description: '全場所有塔射程永久 +1 格',
      emoji: '🌐',
      accentColor: '#67e8f9',
      effect: () => {
        gameState.roguelikeState.rangeBonusGlobal += 1;
        showFloat(640, 300, '萬象射界！全場射程 +1 格！', '#67e8f9', 18);
        updateUI();
      },
    },
    {
      id: 'resonance_speed',
      category: 'resonance',
      title: '時流加速',
      description: '全場塔攻速 +15%（持續 3 波）',
      emoji: '⚡',
      accentColor: '#facc15',
      effect: () => {
        // 若已有攻速 buff，重置持續波次並取較大值
        const bonus = 9; // 60fps * 15% ≈ 冷卻縮短 9 幀
        gameState.roguelikeState.attackSpeedBonus = Math.max(gameState.roguelikeState.attackSpeedBonus, bonus);
        gameState.roguelikeState.attackSpeedWavesLeft = 3;
        showFloat(640, 300, '時流加速！攻速 +15%（3波）', '#facc15', 18);
        updateUI();
      },
    },
    {
      id: 'resonance_gold_wave',
      category: 'resonance',
      title: '波間豐收',
      description: '本波結束獎金額外 +50g',
      emoji: '💰',
      accentColor: '#fb923c',
      effect: () => {
        gameState.gold += 50;
        showFloat(640, 300, '波間豐收 +50g！', '#fb923c', 18);
        updateUI();
      },
    },
  ];
}

// ============================================================
// 卡牌效果輔助函式
// ============================================================

/** 套用元素傷害祝福（最多疊加 2 層 = 最高 +40%） */
function applyElementBlessingBuff(element: string, bonus: number) {
  const el = element as import('../towers').Element;
  const current = (gameState.roguelikeState.elementDmgBonus as Record<string, number>)[element] ?? 0;
  const maxBonus = 0.4; // 最多 +40%
  (gameState.roguelikeState.elementDmgBonus as Record<string, number>)[element] = Math.min(maxBonus, current + bonus);
  const pct = Math.round((gameState.roguelikeState.elementDmgBonus as Record<string, number>)[element] * 100);
  const emojiMap: Record<string, string> = {
    fire: '🔥', water: '💧', wood: '🌿', earth: '🗻', metal: '⚙️', yin: '🌑', yang: '☀️'
  };
  void el; // 防止 TS 未使用警告
  showFloat(640, 300, `${emojiMap[element] || '✨'} ${element} 傷害 +${pct}%！`, '#fbbf24', 18);
  updateUI();
}

/** 從已解鎖塔池隨機選一座塔，設置為當前工具 */
function grantRandomTower() {
  const unlockedIds = Object.keys(BASE_TOWERS).filter(id => {
    if (id === 'earth') return true; // 岩壁塔不送
    return isTowerUnlocked(gameState.talentData, id as TowerTypeId);
  }).filter(id => id !== 'earth'); // 排除岩壁塔送出

  if (unlockedIds.length === 0) {
    // fallback：直接給火塔
    gameState.selectedTool = 'fire';
    showFloat(640, 300, '🎁 獲得烈焰塔！自由放置！', '#ef4444', 18);
    if (gameState.refreshToolSelection) gameState.refreshToolSelection();
    updateUI();
    return;
  }

  const randomId = unlockedIds[Math.floor(Math.random() * unlockedIds.length)] as TowerTypeId;
  const def = BASE_TOWERS[randomId];
  gameState.selectedTool = randomId;
  showFloat(640, 300, `🎁 獲得 ${def.name}！點空格放置！`, '#a78bfa', 18);
  // 設定下次建塔免費
  gameState.roguelikeState.freeNextBuild = true;
  if (gameState.refreshToolSelection) gameState.refreshToolSelection();
  updateUI();
}

// ============================================================
// 卡牌選擇 Modal UI
// ============================================================

let cardPool: RogueCard[] = [];

/** 不重複隨機抽 n 張卡牌 */
function drawCards(n: number): RogueCard[] {
  if (cardPool.length === 0) {
    cardPool = buildCardPool();
  }
  const shuffled = [...cardPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** 顯示波間卡牌選擇 Modal */
export function showCardPicker() {
  const modal = document.getElementById('cardPickerModal');
  if (!modal) return;

  const cards = drawCards(3);
  const grid = document.getElementById('cardPickerGrid');
  if (!grid) return;

  grid.innerHTML = '';
  cards.forEach((card, idx) => {
    const el = document.createElement('div');
    el.className = 'rogue-card';
    el.id = `rogueCard${idx}`;
    el.style.cssText = `
      border-color: ${card.accentColor};
      box-shadow: 0 0 12px ${card.accentColor}55;
    `;
    el.innerHTML = `
      <div class="rogue-card-emoji">${card.emoji}</div>
      <div class="rogue-card-category">${getCategoryLabel(card.category)}</div>
      <div class="rogue-card-title" style="color: ${card.accentColor}">${card.title}</div>
      <div class="rogue-card-desc">${card.description}</div>
    `;
    el.addEventListener('click', () => selectCard(card, idx, cards.length));
    grid.appendChild(el);
  });

  modal.style.display = 'flex';
  // 輕微入場動畫
  requestAnimationFrame(() => {
    modal.classList.add('visible');
  });
}

/** 隱藏卡牌 Modal */
export function hideCardPicker() {
  const modal = document.getElementById('cardPickerModal');
  if (!modal) return;
  modal.classList.remove('visible');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

function getCategoryLabel(cat: CardCategory): string {
  switch (cat) {
    case 'element_blessing': return '元素祝福';
    case 'resource': return '資源補給';
    case 'tower': return '塔牌補給';
    case 'resonance': return '五行共鳴';
  }
}

function selectCard(card: RogueCard, selectedIdx: number, total: number) {
  // 視覺：選中閃光，其餘淡出
  for (let i = 0; i < total; i++) {
    const el = document.getElementById(`rogueCard${i}`);
    if (!el) continue;
    if (i === selectedIdx) {
      el.classList.add('selected');
    } else {
      el.classList.add('dismissed');
    }
  }

  playSFX('merge_success');

  // 套用卡牌效果
  setTimeout(() => {
    card.effect();
    hideCardPicker();
  }, 600);
}

// ============================================================
// 起始隨機補給
// ============================================================

/** 開局時從已解鎖塔池隨機免費給予 2 座不同元素的 Lv1 塔（教學關與測試關卡除外） */
export function grantStartBonus() {
  // 教學關：保持引導流程，不插入隨機補給
  // 測試關：無意義的補給，也不觸發
  if (gameState.currentMap.id === 'test_level' || gameState.currentMap.id === 'tutorial') return;

  const allBaseIds = Object.keys(BASE_TOWERS).filter(id => id !== 'earth');
  const unlockedIds = allBaseIds.filter(id =>
    isTowerUnlocked(gameState.talentData, id as TowerTypeId)
  );

  if (unlockedIds.length === 0) return;

  // 確保至少 2 種不同元素
  const shuffled = [...unlockedIds].sort(() => Math.random() - 0.5);
  const picked: string[] = [];
  const pickedElements = new Set<string>();

  for (const id of shuffled) {
    if (picked.length >= 2) break;
    const def = BASE_TOWERS[id];
    if (!pickedElements.has(def.element)) {
      picked.push(id);
      pickedElements.add(def.element);
    }
  }

  // 若解鎖塔不足 2 種元素，補足
  if (picked.length < 2 && unlockedIds.length > 0) {
    for (const id of shuffled) {
      if (picked.length >= 2) break;
      if (!picked.includes(id)) picked.push(id);
    }
  }

  picked.forEach(id => {
    const def = BASE_TOWERS[id];
    const messages = [`🎁 開局補給：${def.name}`];
    setTimeout(() => {
      showFloat(640, 320, messages[0], '#a78bfa', 16);
    }, picked.indexOf(id) * 500);
  });

  // 儲存補給塔列表到 roguelikeState，供 uiManager 顯示
  (gameState.roguelikeState as any).startBonusTowers = picked;
  (gameState.roguelikeState as any).startBonusIndex = 0;

  // 設第一座為當前工具 + 免費建塔
  if (picked.length > 0) {
    gameState.selectedTool = picked[0];
    gameState.roguelikeState.freeNextBuild = true;
    if (gameState.refreshToolSelection) gameState.refreshToolSelection();
  }
}

// ============================================================
// 神秘召喚
// ============================================================

/** 計算神秘召喚定價 */
export function calcMysteryBoxPrice(): number {
  const unlockedIds = Object.keys(BASE_TOWERS).filter(id => {
    if (id === 'earth') return false; // 排除岩壁塔
    return isTowerUnlocked(gameState.talentData, id as TowerTypeId);
  });
  const activeIds = unlockedIds.length > 0 ? unlockedIds : ['fire'];
  
  const costs = activeIds.map(id => BASE_TOWERS[id]?.cost ?? 10);
  const expectation = costs.reduce((a, b) => a + b, 0) / costs.length;
  const maxCost = Math.max(...costs);
  return Math.max(5, Math.max(Math.floor(expectation * 0.75), Math.floor(maxCost * 0.7)));
}

/** 執行神秘召喚 */
export function rollMysteryBox() {
  if (gameState.currentScene !== 'BATTLE') return;

  const unlockedIds = Object.keys(BASE_TOWERS).filter(id => {
    if (id === 'earth') return false; // 排除岩壁塔
    return isTowerUnlocked(gameState.talentData, id as TowerTypeId);
  });
  const activeIds = unlockedIds.length > 0 ? unlockedIds : ['fire'];

  if (gameState.currentMap.id === 'test_level') {
    // 測試關卡免費
  } else {
    const price = gameState.roguelikeState.mysteryBoxPrice;
    if (gameState.gold < price) {
      showFloat(640, 320, `金幣不足（需 ${price}g）`, '#ef4444', 15);
      return;
    }
    gameState.gold -= price;
  }

  const randomId = activeIds[Math.floor(Math.random() * activeIds.length)] as TowerTypeId;
  const def = BASE_TOWERS[randomId];

  // 召喚的塔設為當前工具 + 標記免費放置（已付召喚費，放置不再扣款）
  gameState.selectedTool = randomId;
  gameState.roguelikeState.freeNextBuild = true;
  if (gameState.refreshToolSelection) gameState.refreshToolSelection();

  showFloat(640, 300, `🎲 召喚：${def.name}！點空格放置`, '#c084fc', 16);
  playSFX('merge_success');
  updateUI();
}

// ============================================================
// 波次 Buff 衰減（波次開始時呼叫）
// ============================================================

/** 每波次開始時處理有限持續的 Buff 衰減 */
export function tickWaveBuffs() {
  const rl = gameState.roguelikeState;
  if (rl.attackSpeedWavesLeft > 0) {
    rl.attackSpeedWavesLeft--;
    if (rl.attackSpeedWavesLeft === 0) {
      rl.attackSpeedBonus = 0;
      showFloat(640, 300, '時流加速 效果結束', '#94a3b8', 14);
    }
  }
}
