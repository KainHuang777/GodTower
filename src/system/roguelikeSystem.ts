// ============================================================
// src/system/roguelikeSystem.ts — Roguelike 增益卡牌系統
// ============================================================
//
// 三大機制：
//   1. 波間三選一卡牌 (Wave End Card Picker) — 帶有 Rarity (普通/稀有/傳說) 系統
//   2. 起始隨機補給 (Start Bonus)
//   3. 神秘召喚 (Mystery Summon)

import { gameState } from '../state';
import { BASE_TOWERS, TowerTypeId, CROSS_RECIPES, getSameMergeResult, getTowerDef } from '../towers';
import { isTowerUnlocked, isTraitSeen } from '../talent';
import { showFloat } from '../renderer/gameRenderer';
import { updateUI } from '../ui/uiManager';
import { playSFX } from '../audio/audioSystem';

// ============================================================
// 稀有度與卡牌定義
// ============================================================

export type Rarity = 'common' | 'rare' | 'legendary';

export function getRarityLabel(rarity: Rarity): string {
  switch (rarity) {
    case 'common': return '普通';
    case 'rare': return '稀有';
    case 'legendary': return '傳說';
  }
}

export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'common': return '#94a3b8';
    case 'rare': return '#3b82f6';
    case 'legendary': return '#f59e0b';
  }
}

export type CardCategory = 'element_blessing' | 'resource' | 'tower' | 'resonance' | 'trait_counter';

export interface RogueCard {
  id: string;
  category: CardCategory;
  rarity: Rarity;
  title: string;
  description: string;
  emoji: string;
  accentColor: string;
  effect: () => void;
}

/** 建立完整的稀有度分級卡牌池 */
function buildCardPool(): RogueCard[] {
  return [
    // ==========================================
    // ── 普通卡牌 (Common) ──
    // ==========================================
    {
      id: 'blessing_fire_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微火祝福',
      description: '本局火系塔傷害 +15%（最多疊 3 層）',
      emoji: '🔥',
      accentColor: '#ef4444',
      effect: () => applyElementBlessingBuff('fire', 0.15, 0.45),
    },
    {
      id: 'blessing_water_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微水祝福',
      description: '本局水系塔傷害 +15%（最多疊 3 層）',
      emoji: '💧',
      accentColor: '#38bdf8',
      effect: () => applyElementBlessingBuff('water', 0.15, 0.45),
    },
    {
      id: 'blessing_wood_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微木祝福',
      description: '本局木系塔傷害 +15%（最多疊 3 層）',
      emoji: '🌿',
      accentColor: '#22c55e',
      effect: () => applyElementBlessingBuff('wood', 0.15, 0.45),
    },
    {
      id: 'blessing_earth_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微土祝福',
      description: '本局土系塔傷害 +15%（最多疊 3 層）',
      emoji: '🗿',
      accentColor: '#fbbf24',
      effect: () => applyElementBlessingBuff('earth', 0.15, 0.45),
    },
    {
      id: 'blessing_metal_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微金祝福',
      description: '本局金系塔傷害 +15%（最多疊 3 層）',
      emoji: '⚙️',
      accentColor: '#cbd5e1',
      effect: () => applyElementBlessingBuff('metal', 0.15, 0.45),
    },
    {
      id: 'blessing_yin_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微陰祝福',
      description: '本局陰系塔傷害 +15%（最多疊 3 層）',
      emoji: '🌑',
      accentColor: '#c084fc',
      effect: () => applyElementBlessingBuff('yin', 0.15, 0.45),
    },
    {
      id: 'blessing_yang_common',
      category: 'element_blessing',
      rarity: 'common',
      title: '微陽祝福',
      description: '本局陽系塔傷害 +15%（最多疊 3 層）',
      emoji: '☀️',
      accentColor: '#fde047',
      effect: () => applyElementBlessingBuff('yang', 0.15, 0.45),
    },
    {
      id: 'resource_gold_common',
      category: 'resource',
      rarity: 'common',
      title: '小金雨',
      description: '立即獲得 25 金幣',
      emoji: '🪙',
      accentColor: '#f59e0b',
      effect: () => {
        gameState.gold += 25;
        showFloat(640, 300, '金幣 +25g！', '#f59e0b', 18);
        updateUI();
      },
    },
    {
      id: 'resource_hp_common',
      category: 'resource',
      rarity: 'common',
      title: '微型補給',
      description: '立即恢復 1 點基地生命',
      emoji: '💚',
      accentColor: '#4ade80',
      effect: () => {
        gameState.hp += 1;
        showFloat(640, 300, '回復 1 HP！', '#4ade80', 18);
        updateUI();
      },
    },
    {
      id: 'resonance_merge_discount_common',
      category: 'resonance',
      rarity: 'common',
      title: '初級共鳴',
      description: '下一次合成費用減少 30%',
      emoji: '☯️',
      accentColor: '#818cf8',
      effect: () => {
        gameState.roguelikeState.nextMergeCostPct = 0.7;
        showFloat(640, 300, '下次合成費 -30%！', '#818cf8', 18);
        updateUI();
      },
    },
    {
      id: 'resonance_speed_common',
      category: 'resonance',
      rarity: 'common',
      title: '微光加速',
      description: '全場塔攻速 +10%（持續 3 波）',
      emoji: '⚡',
      accentColor: '#facc15',
      effect: () => {
        const bonus = 6;
        gameState.roguelikeState.attackSpeedBonus = Math.max(gameState.roguelikeState.attackSpeedBonus, bonus);
        gameState.roguelikeState.attackSpeedWavesLeft = 3;
        showFloat(640, 300, '攻速 +10%（3波）', '#facc15', 18);
        updateUI();
      },
    },

    // ==========================================
    // ── 稀有卡牌 (Rare) ──
    // ==========================================
    {
      id: 'blessing_fire_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '烈火天賜',
      description: '本局火系塔傷害 +35%（最多疊 2 層）',
      emoji: '🔥',
      accentColor: '#ef4444',
      effect: () => applyElementBlessingBuff('fire', 0.35, 0.70),
    },
    {
      id: 'blessing_water_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '狂瀾天賜',
      description: '本局水系塔傷害 +35%（最多疊 2 層）',
      emoji: '💧',
      accentColor: '#38bdf8',
      effect: () => applyElementBlessingBuff('water', 0.35, 0.70),
    },
    {
      id: 'blessing_wood_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '森羅天賜',
      description: '本局木系塔傷害 +35%（最多疊 2 層）',
      emoji: '🌿',
      accentColor: '#22c55e',
      effect: () => applyElementBlessingBuff('wood', 0.35, 0.70),
    },
    {
      id: 'blessing_earth_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '裂地天賜',
      description: '本局土系塔傷害 +35%（最多疊 2 層）',
      emoji: '🗿',
      accentColor: '#fbbf24',
      effect: () => applyElementBlessingBuff('earth', 0.35, 0.70),
    },
    {
      id: 'blessing_metal_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '銳金天賜',
      description: '本局金系塔傷害 +35%（最多疊 2 層）',
      emoji: '⚙️',
      accentColor: '#cbd5e1',
      effect: () => applyElementBlessingBuff('metal', 0.35, 0.70),
    },
    {
      id: 'blessing_yin_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '幽冥天賜',
      description: '本局陰系塔傷害 +35%（最多疊 2 層）',
      emoji: '🌑',
      accentColor: '#c084fc',
      effect: () => applyElementBlessingBuff('yin', 0.35, 0.70),
    },
    {
      id: 'blessing_yang_rare',
      category: 'element_blessing',
      rarity: 'rare',
      title: '烈陽天賜',
      description: '本局陽系塔傷害 +35%（最多疊 2 層）',
      emoji: '☀️',
      accentColor: '#fde047',
      effect: () => applyElementBlessingBuff('yang', 0.35, 0.70),
    },
    {
      id: 'resource_gold_rare',
      category: 'resource',
      rarity: 'rare',
      title: '豐收雨',
      description: '立即獲得 55 金幣',
      emoji: '🪙',
      accentColor: '#fb923c',
      effect: () => {
        gameState.gold += 55;
        showFloat(640, 300, '金幣 +55g！', '#fb923c', 18);
        updateUI();
      },
    },
    {
      id: 'resource_hp_rare',
      category: 'resource',
      rarity: 'rare',
      title: '戰地修復',
      description: '立即恢復 3 點基地生命',
      emoji: '💚',
      accentColor: '#22c55e',
      effect: () => {
        gameState.hp += 3;
        showFloat(640, 300, '回復 3 HP！', '#22c55e', 18);
        updateUI();
      },
    },
    {
      id: 'resource_free_build_rare',
      category: 'resource',
      rarity: 'rare',
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
    {
      id: 'tower_random_rare',
      category: 'tower',
      rarity: 'rare',
      title: '隨機補給',
      description: '隨機獲得一座已解鎖 Lv1 塔（直接選取，點格子放置）',
      emoji: '🎁',
      accentColor: '#a78bfa',
      effect: () => grantRandomTower(),
    },
    {
      id: 'resonance_range_rare',
      category: 'resonance',
      rarity: 'rare',
      title: '萬象射界',
      description: '全場所有塔射程永久 +1 格',
      emoji: '🌐',
      accentColor: '#67e8f9',
      effect: () => {
        gameState.roguelikeState.rangeBonusGlobal += 1;
        showFloat(640, 300, '全場射程 +1 格！', '#67e8f9', 18);
        updateUI();
      },
    },
    {
      id: 'resonance_speed_rare',
      category: 'resonance',
      rarity: 'rare',
      title: '時流加速',
      description: '全場塔攻速 +25%（持續 3 波）',
      emoji: '⚡',
      accentColor: '#fbbf24',
      effect: () => {
        const bonus = 15;
        gameState.roguelikeState.attackSpeedBonus = Math.max(gameState.roguelikeState.attackSpeedBonus, bonus);
        gameState.roguelikeState.attackSpeedWavesLeft = 3;
        showFloat(640, 300, '攻速 +25%（3波）', '#fbbf24', 18);
        updateUI();
      },
    },

    // ==========================================
    // ── 傳說卡牌 (Legendary) ──
    // ==========================================
    {
      id: 'blessing_all_legendary',
      category: 'element_blessing',
      rarity: 'legendary',
      title: '太極大共鳴',
      description: '全場所有防禦塔傷害永久 +15% 且攻速永久 +10%',
      emoji: '☯️',
      accentColor: '#fde047',
      effect: () => {
        const elements = ['fire', 'water', 'wood', 'earth', 'metal', 'yin', 'yang'];
        elements.forEach(el => {
          const current = (gameState.roguelikeState.elementDmgBonus as Record<string, number>)[el] ?? 0;
          (gameState.roguelikeState.elementDmgBonus as Record<string, number>)[el] = current + 0.15;
        });
        const rl = gameState.roguelikeState as any;
        rl.permanentAttackSpeedBonus = (rl.permanentAttackSpeedBonus ?? 0) + 6;
        showFloat(640, 300, '☯️ 太極大共鳴！全體攻防永久提升！', '#fde047', 18);
        updateUI();
      },
    },
    {
      id: 'tower_random_2_legendary',
      category: 'tower',
      rarity: 'legendary',
      title: '雙重補給',
      description: '隨機獲得兩座已解鎖 Lv1 塔（逐次免費放置）',
      emoji: '🎀',
      accentColor: '#f472b6',
      effect: () => {
        grantRandomTower();
        setTimeout(() => grantRandomTower(), 500);
      },
    },
    {
      id: 'tower_legendary_summon',
      category: 'tower',
      rarity: 'legendary',
      title: '命運召喚',
      description: '隨機獲得一座已解鎖的 Lv2 合成塔（直接免費放置）',
      emoji: '🔮',
      accentColor: '#a78bfa',
      effect: () => grantRandomLv2Tower(),
    },
    {
      id: 'resource_gold_legendary',
      category: 'resource',
      rarity: 'legendary',
      title: '點石成金',
      description: '立即獲得 100 金幣，且下兩次建塔免費',
      emoji: '👑',
      accentColor: '#fbbf24',
      effect: () => {
        gameState.gold += 100;
        const rl = gameState.roguelikeState as any;
        rl.freeBuildCharges = (rl.freeBuildCharges ?? 0) + 2;
        rl.freeNextBuild = true;
        showFloat(640, 300, '👑 獲得 100g 且下兩次建塔免費！', '#fbbf24', 18);
        updateUI();
      },
    },
    {
      id: 'resource_hp_legendary',
      category: 'resource',
      rarity: 'legendary',
      title: '基地大修',
      description: '立即恢復 6 點基地生命（可突破上限）',
      emoji: '💖',
      accentColor: '#f43f5e',
      effect: () => {
        gameState.hp += 6;
        showFloat(640, 300, '💖 基地大修！HP +6！', '#f43f5e', 18);
        updateUI();
      },
    },

    // ==========================================
    // ── P2: 詞條對策卡 (trait_counter) ──
    // ==========================================
    // 普通卡
    {
      id: 'trait_armor_common',
      category: 'trait_counter',
      rarity: 'common',
      title: '破甲一擊',
      description: '對裝甲怪首次命中必為暴擊',
      emoji: '🛡️',
      accentColor: '#94a3b8',
      effect: () => {
        gameState.roguelikeState.armorBreakNext = true;
        showFloat(640, 300, '破甲一擊！首次裝甲命中必暴', '#94a3b8', 16);
      },
    },
    {
      id: 'trait_regen_common',
      category: 'trait_counter',
      rarity: 'common',
      title: '灼燒標記',
      description: '命中再生怪使其 3 秒內無法回血',
      emoji: '🔥',
      accentColor: '#94a3b8',
      effect: () => {
        gameState.roguelikeState.regenBlockDuration = 180;
        showFloat(640, 300, '灼燒標記！下次再生怪 3 秒不回血', '#94a3b8', 16);
      },
    },
    {
      id: 'trait_split_common',
      category: 'trait_counter',
      rarity: 'common',
      title: '速攻指令',
      description: '分裂怪進入分裂血量前 +30% 傷害',
      emoji: '⚡',
      accentColor: '#94a3b8',
      effect: () => {
        gameState.roguelikeState.splitBurstActive = true;
        showFloat(640, 300, '速攻指令！分裂前 +30% 傷害', '#94a3b8', 16);
      },
    },
    // 稀有卡
    {
      id: 'trait_armor_rare',
      category: 'trait_counter',
      rarity: 'rare',
      title: '五行破甲',
      description: '對裝甲怪相剋加成再 +25%',
      emoji: '💢',
      accentColor: '#3b82f6',
      effect: () => {
        gameState.roguelikeState.counterBonusVsArmor = 0.25;
        showFloat(640, 300, '五行破甲！相剋對裝甲 +25%', '#3b82f6', 16);
      },
    },
    {
      id: 'trait_regen_rare',
      category: 'trait_counter',
      rarity: 'rare',
      title: '毒纏',
      description: '再生怪回血效果反轉為流血',
      emoji: '☠️',
      accentColor: '#3b82f6',
      effect: () => {
        gameState.roguelikeState.regenReverseActive = true;
        showFloat(640, 300, '毒纏！再生反轉為流血！', '#3b82f6', 16);
      },
    },
    {
      id: 'trait_split_rare',
      category: 'trait_counter',
      rarity: 'rare',
      title: '制止分裂',
      description: '本局分裂怪不會分裂',
      emoji: '🔒',
      accentColor: '#3b82f6',
      effect: () => {
        gameState.roguelikeState.splitBlockActive = true;
        showFloat(640, 300, '制止分裂！分裂怪不再分裂！', '#3b82f6', 16);
      },
    },
    // 傳說卡
    {
      id: 'trait_armor_legendary',
      category: 'trait_counter',
      rarity: 'legendary',
      title: '無視護甲',
      description: '本局所有攻擊對裝甲怪為真實傷害',
      emoji: '⚔️',
      accentColor: '#f59e0b',
      effect: () => {
        gameState.roguelikeState.trueDamageVsArmor = true;
        showFloat(640, 300, '無視護甲！全攻擊變真實傷害！', '#f59e0b', 18);
      },
    },
    {
      id: 'trait_regen_legendary',
      category: 'trait_counter',
      rarity: 'legendary',
      title: '封印再生',
      description: '本局所有再生怪永久停止回血',
      emoji: '🔮',
      accentColor: '#f59e0b',
      effect: () => {
        gameState.roguelikeState.regenLockActive = true;
        showFloat(640, 300, '封印再生！不再回血！', '#f59e0b', 18);
      },
    },
    {
      id: 'trait_split_legendary',
      category: 'trait_counter',
      rarity: 'legendary',
      title: '反向分裂',
      description: '分裂怪分裂時玩家獲得 10 金幣',
      emoji: '💰',
      accentColor: '#f59e0b',
      effect: () => {
        gameState.roguelikeState.splitRewardActive = true;
        showFloat(640, 300, '反向分裂！分裂得 10g！', '#f59e0b', 18);
      },
    },
  ];
}

// ============================================================
// 卡牌效果輔助函式
// ============================================================

/** 套用元素傷害祝福 */
function applyElementBlessingBuff(element: string, bonus: number, maxLimit: number) {
  const el = element as import('../towers').Element;
  const current = (gameState.roguelikeState.elementDmgBonus as Record<string, number>)[element] ?? 0;
  (gameState.roguelikeState.elementDmgBonus as Record<string, number>)[element] = Math.min(maxLimit, current + bonus);
  const pct = Math.round((gameState.roguelikeState.elementDmgBonus as Record<string, number>)[element] * 100);
  const emojiMap: Record<string, string> = {
    fire: '🔥', water: '💧', wood: '🌿', earth: '🗻', metal: '⚙️', yin: '🌑', yang: '☀️'
  };
  void el;
  showFloat(640, 300, `${emojiMap[element] || '✨'} ${element} 傷害 +${pct}%！`, '#fbbf24', 18);
  updateUI();
}

/** 從已解鎖塔池隨機選一座塔，設置為當前工具 */
function grantRandomTower() {
  const unlockedIds = Object.keys(BASE_TOWERS).filter(id => {
    if (id === 'earth') return true; // 岩壁塔不送
    return isTowerUnlocked(gameState.talentData, id as TowerTypeId);
  }).filter(id => id !== 'earth');

  if (unlockedIds.length === 0) {
    gameState.selectedTool = 'fire';
    showFloat(640, 300, '🎁 獲得烈焰塔！自由放置！', '#ef4444', 18);
    if (gameState.refreshToolSelection) gameState.refreshToolSelection();
    updateUI();
    return;
  }

  const randomId = unlockedIds[Math.floor(Math.random() * unlockedIds.length)] as TowerTypeId;
  const def = BASE_TOWERS[randomId];
  gameState.mergeMode = false;
  gameState.mergeFirstTower = null;
  gameState.selectedTool = randomId;
  showFloat(640, 300, `🎁 獲得 ${def.name}！點空格放置！`, '#a78bfa', 18);
  gameState.roguelikeState.freeNextBuild = true;
  if (gameState.refreshToolSelection) gameState.refreshToolSelection();
  updateUI();
}

/** 命運召喚：隨機獲取並放置已解鎖元素對應的 Lv2 合成塔 */
function grantRandomLv2Tower() {
  const allBaseIds = ['fire', 'water', 'wood', 'earth', 'metal', 'yin', 'yang'];
  const unlockedElements = allBaseIds.filter(el => 
    isTowerUnlocked(gameState.talentData, el as TowerTypeId)
  );

  const candidateIds: TowerTypeId[] = [];

  // 1. 同系 Lv2 候選
  unlockedElements.forEach(el => {
    const lv2Id = getSameMergeResult(el as import('../towers').Element);
    if (lv2Id) candidateIds.push(lv2Id);
  });

  // 2. 異系合成候選
  const frozen = ['metal_water', 'water_wood'];
  for (const recipe of CROSS_RECIPES) {
    if (frozen.includes(recipe.output)) continue;
    if (unlockedElements.includes(recipe.input1) && unlockedElements.includes(recipe.input2)) {
      candidateIds.push(recipe.output);
    }
  }

  // 確保至少有 fire_2 作為 fallback
  const pickedId = candidateIds.length > 0 
    ? candidateIds[Math.floor(Math.random() * candidateIds.length)] 
    : 'fire_2';

  const def = getTowerDef(pickedId);
  if (def) {
    gameState.mergeMode = false;
    gameState.mergeFirstTower = null;
    gameState.selectedTool = pickedId;
    gameState.roguelikeState.freeNextBuild = true;
    if (gameState.refreshToolSelection) gameState.refreshToolSelection();
    showFloat(640, 300, `🔮 命運召喚：獲得 ${def.name}！點空格放置`, '#c084fc', 16);
    playSFX('merge_success');
    updateUI();
  }
}

// ============================================================
// 卡牌選擇 Modal UI
// ============================================================

let cardPool: RogueCard[] = [];

/** 依據波次權重與稀有度不重複隨機抽 n 張卡牌 */
function drawCards(n: number): RogueCard[] {
  if (cardPool.length === 0) {
    cardPool = buildCardPool();
  }

  // P2: 過濾 trait_counter 卡 — 僅在已見過對應詞條時才可抽取
  cardPool = cardPool.filter(c => {
    if (c.category !== 'trait_counter') return true;
    if (!gameState.talentData) return false;
    if (c.id.includes('armor')) return isTraitSeen(gameState.talentData, 'armor');
    if (c.id.includes('regen')) return isTraitSeen(gameState.talentData, 'regen');
    if (c.id.includes('split')) return isTraitSeen(gameState.talentData, 'split');
    return false;
  });

  // 根據當前波次動態計算稀有度權重機率
  const wave = gameState.wave;
  let pCommon = 0.85;
  let pRare = 0.15;

  if (wave >= 6 && wave <= 10) {
    pCommon = 0.55;
    pRare = 0.35;
  } else if (wave >= 11 && wave <= 15) {
    pCommon = 0.30;
    pRare = 0.45;
  } else if (wave >= 16) {
    pCommon = 0.10;
    pRare = 0.50;
  }

  const drawnCards: RogueCard[] = [];
  const drawnIds = new Set<string>();

  for (let i = 0; i < n; i++) {
    const r = Math.random();
    let rarity: Rarity = 'common';
    if (r < pCommon) {
      rarity = 'common';
    } else if (r < pCommon + pRare) {
      rarity = 'rare';
    } else {
      rarity = 'legendary';
    }

    // 從特定稀有度的卡池篩選未被抽取的卡
    let pool = cardPool.filter(c => c.rarity === rarity && !drawnIds.has(c.id));

    // 如果該稀有度的子卡池已抽乾，則 fallback 到所有未抽取的卡
    if (pool.length === 0) {
      pool = cardPool.filter(c => !drawnIds.has(c.id));
    }

    if (pool.length === 0) {
      break;
    }

    const card = pool[Math.floor(Math.random() * pool.length)];
    drawnCards.push(card);
    drawnIds.add(card.id);
  }

  return drawnCards;
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
    // 套用對應稀有度的 CSS 樣式
    el.className = `rogue-card rarity-${card.rarity}`;
    el.id = `rogueCard${idx}`;
    
    el.innerHTML = `
      <div class="rogue-card-emoji">${card.emoji}</div>
      <div class="rogue-card-category" style="border: 1px solid ${getRarityColor(card.rarity)}aa; color: ${getRarityColor(card.rarity)}; background: ${getRarityColor(card.rarity)}15;">
        ${getRarityLabel(card.rarity)} · ${getCategoryLabel(card.category)}
      </div>
      <div class="rogue-card-title" style="color: ${card.accentColor}">${card.title}</div>
      <div class="rogue-card-desc">${card.description}</div>
    `;
    el.addEventListener('click', () => selectCard(card, idx, cards.length));
    grid.appendChild(el);
  });

  modal.style.display = 'flex';
  void modal.offsetWidth;
  modal.classList.add('visible');
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
    case 'trait_counter': return '詞條對策';
  }
}

function selectCard(card: RogueCard, selectedIdx: number, total: number) {
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

  setTimeout(() => {
    card.effect();
    hideCardPicker();
  }, 600);
}

// ============================================================
// 起始隨機補給
// ============================================================

/** 開局時從已解鎖塔池隨機免費給予 2 座不同元素的 Lv1 塔 */
export function grantStartBonus() {
  if (gameState.currentMap.id === 'test_level' || gameState.currentMap.id === 'tutorial') return;

  const allBaseIds = Object.keys(BASE_TOWERS).filter(id => id !== 'earth');
  const unlockedIds = allBaseIds.filter(id =>
    isTowerUnlocked(gameState.talentData, id as TowerTypeId)
  );

  if (unlockedIds.length === 0) return;

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

  (gameState.roguelikeState as any).startBonusTowers = picked;
  (gameState.roguelikeState as any).startBonusIndex = 0;

  if (picked.length > 0) {
    gameState.mergeMode = false;
    gameState.mergeFirstTower = null;
    gameState.selectedTool = picked[0];
    gameState.roguelikeState.freeNextBuild = true;
    if (gameState.refreshToolSelection) gameState.refreshToolSelection();
  }
}

// ============================================================
// 神秘召喚
// ============================================================

export function calcMysteryBoxPrice(): number {
  const unlockedIds = Object.keys(BASE_TOWERS).filter(id => {
    if (id === 'earth') return false;
    return isTowerUnlocked(gameState.talentData, id as TowerTypeId);
  });
  const activeIds = unlockedIds.length > 0 ? unlockedIds : ['fire'];
  
  const costs = activeIds.map(id => BASE_TOWERS[id]?.cost ?? 10);
  const expectation = costs.reduce((a, b) => a + b, 0) / costs.length;
  const maxCost = Math.max(...costs);
  return Math.max(5, Math.max(Math.floor(expectation * 0.75), Math.floor(maxCost * 0.7)));
}

export function rollMysteryBox() {
  if (gameState.currentScene !== 'BATTLE') return;

  const unlockedIds = Object.keys(BASE_TOWERS).filter(id => {
    if (id === 'earth') return false;
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

  gameState.mergeMode = false;
  gameState.mergeFirstTower = null;
  gameState.selectedTool = randomId;
  gameState.roguelikeState.freeNextBuild = true;
  if (gameState.refreshToolSelection) gameState.refreshToolSelection();

  showFloat(640, 300, `🎲 召喚：${def.name}！點空格放置`, '#c084fc', 16);
  playSFX('merge_success');
  updateUI();
}

// ============================================================
// 波次 Buff 衰減
// ============================================================

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
