// ============================================================
// src/talent.ts — 天賦樹定義、平台抽象存檔持久化
// ============================================================

import { currentSaveStorage } from './system/platform';
import type { Element } from './towers';

const STORAGE_KEY = 'checkpoint_maze_td_talent';

/** 天賦節點 ID */
export type TalentId =
  | 'fortress_1' | 'fortress_2'
  | 'gold_1' | 'gold_2'
  | 'precise_1' | 'precise_2' | 'rapid_fire'
  | 'wood_awakening' | 'water_awakening' | 'fire_awakening' | 'earth_awakening' | 'metal_awakening'
  | 'yin_law' | 'yang_law' | 'taiji_dao'
  | 'wall_discount';

/** 天賦節點定義 */
export interface TalentNode {
  id: TalentId;
  name: string;
  description: string;
  cost: number;           // 每次升級需要的天賦點
  prerequisites: TalentId[]; // 前置天賦
  category: 'base' | 'attack' | 'element' | 'yinyang';
  maxLevel: number;       // 最大等級
}

/** 天賦樹完整定義 */
export const TALENT_TREE: TalentNode[] = [
  // 基礎強化路線
  { id: 'fortress_1', name: '堅固堡壘 I', description: '每級基地生命 +5', cost: 2, prerequisites: [], category: 'base', maxLevel: 5 },
  { id: 'fortress_2', name: '堅固堡壘 II', description: '每級基地生命 +10', cost: 2, prerequisites: ['fortress_1'], category: 'base', maxLevel: 5 },
  { id: 'gold_1', name: '初始資金 I', description: '每級開局金幣 +20', cost: 2, prerequisites: [], category: 'base', maxLevel: 5 },
  { id: 'gold_2', name: '初始資金 II', description: '每級開局金幣 +30', cost: 2, prerequisites: ['gold_1'], category: 'base', maxLevel: 5 },

  // 攻擊強化路線
  { id: 'precise_1', name: '精準射擊 I', description: '每級所有砲台傷害 +10%', cost: 2, prerequisites: [], category: 'attack', maxLevel: 5 },
  { id: 'precise_2', name: '精準射擊 II', description: '每級所有砲台傷害 +15%', cost: 2, prerequisites: ['precise_1'], category: 'attack', maxLevel: 5 },
  { id: 'rapid_fire', name: '急速射擊', description: '每級所有砲台冷卻時間 -5%', cost: 3, prerequisites: ['precise_1'], category: 'attack', maxLevel: 5 },

  // 五行解鎖路線
  { id: 'wood_awakening',  name: '木行覺醒', description: '解鎖纏繞塔 🌿，每級木系塔傷害 +10%', cost: 2, prerequisites: [], category: 'element', maxLevel: 5 },
  { id: 'water_awakening', name: '水行覺醒', description: '解鎖冰凍塔 💧，每級水系塔傷害 +10%', cost: 2, prerequisites: [], category: 'element', maxLevel: 5 },
  { id: 'fire_awakening',  name: '火行覺醒', description: '強化烈焰塔 🔥，每級火系塔傷害 +10% (火系預設解鎖)', cost: 2, prerequisites: [], category: 'element', maxLevel: 5 },
  { id: 'earth_awakening', name: '土行覺醒', description: '強化岩壁塔 ⛰️，每級土系塔效果/傷害 +10% (土系預設解鎖)', cost: 2, prerequisites: [], category: 'element', maxLevel: 5 },
  { id: 'wall_discount',   name: '築牆工法', description: '使岩壁塔（牆壁）的造價降低至 1g (預設為 2g)', cost: 2, prerequisites: ['earth_awakening'], category: 'element', maxLevel: 1 },
  { id: 'metal_awakening', name: '金行覺醒', description: '解鎖鏡刃塔 ⚔️，每級金系塔傷害 +10%', cost: 2, prerequisites: [], category: 'element', maxLevel: 5 },

  // 陰陽解鎖路線
  { id: 'yin_law',   name: '陰之法則', description: '解鎖暗影塔 🌑，每級陰系塔傷害 +10%', cost: 3, prerequisites: [], category: 'yinyang', maxLevel: 5 },
  { id: 'yang_law',  name: '陽之法則', description: '解鎖聖光塔 ☀️，每級陽系塔傷害 +10%', cost: 3, prerequisites: [], category: 'yinyang', maxLevel: 5 },
  { id: 'taiji_dao', name: '太極之道', description: '解鎖陰陽合成配方 ☯️，每級太極塔傷害 +10%', cost: 5, prerequisites: ['yin_law', 'yang_law'], category: 'yinyang', maxLevel: 5 },
];

/** 儲存的玩家天賦資料 */
export interface TalentSaveData {
  totalTalentPoints: number;
  spentTalentPoints: number;
  talentLevels: Partial<Record<TalentId, number>>;
  unlockedTalents?: TalentId[]; // 舊資料相容用
  hasPlayedBefore?: boolean;    // P3: 新手引導標誌

  // P1: 72hr 曲線 — 雙軌成就系統
  personalBest?: number;          // 最高存活波次
  milestones?: number[];          // 已達成里程碑（5/10/15/20）
  completedAchievements?: string[]; // 已完成的成就 ID
  achievementCount?: number;      // 成就完成次數（雙軌用）
  totalDamageDealt?: number;      // 累計總傷害
  resetCount?: number;            // 天賦重置次數
  seenTraits?: { armor?: boolean; regen?: boolean; split?: boolean }; // P2: 已見過的怪物詞條
}

/** 從 platform 載入天賦資料 */
export function loadTalentData(): TalentSaveData {
  try {
    const raw = currentSaveStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 舊存檔相容性轉換
      if (parsed && !parsed.talentLevels) {
        parsed.talentLevels = {};
        if (Array.isArray(parsed.unlockedTalents)) {
          for (const tid of parsed.unlockedTalents) {
            parsed.talentLevels[tid] = 1;
          }
        }
      }
      // 確保 P1 新欄位預設值
      if (parsed && typeof parsed.talentLevels === 'object') {
        if (parsed.personalBest === undefined) parsed.personalBest = 0;
        if (!Array.isArray(parsed.milestones)) parsed.milestones = [];
        if (!Array.isArray(parsed.completedAchievements)) parsed.completedAchievements = [];
        if (typeof parsed.achievementCount !== 'number') parsed.achievementCount = 0;
        if (typeof parsed.totalDamageDealt !== 'number') parsed.totalDamageDealt = 0;
        if (typeof parsed.resetCount !== 'number') parsed.resetCount = 0;
        if (!parsed.seenTraits || typeof parsed.seenTraits !== 'object') parsed.seenTraits = {};
        return parsed as TalentSaveData;
      }
    }
  } catch { /* ignore */ }
  return {
    totalTalentPoints: 0,
    spentTalentPoints: 0,
    talentLevels: {} as Record<TalentId, number>,
    hasPlayedBefore: false,
    personalBest: 0,
    milestones: [],
    completedAchievements: [],
    achievementCount: 0,
    totalDamageDealt: 0,
    resetCount: 0,
  };
}

/** 儲存天賦資料到 platform */
export function saveTalentData(data: TalentSaveData): void {
  currentSaveStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 計算可用天賦點 */
export function getAvailablePoints(data: TalentSaveData): number {
  return data.totalTalentPoints - data.spentTalentPoints;
}

/** 檢查天賦是否可解鎖或升級 */
export function canUnlockTalent(data: TalentSaveData, talentId: TalentId): boolean {
  const node = TALENT_TREE.find(t => t.id === talentId);
  if (!node) return false;

  const currentLvl = data.talentLevels[talentId] || 0;
  // 已達最大等級
  if (currentLvl >= node.maxLevel) return false;

  // 點數不足
  if (getAvailablePoints(data) < node.cost) return false;

  // 檢查前置天賦是否至少解鎖 1 級
  for (const prereq of node.prerequisites) {
    if ((data.talentLevels[prereq] || 0) < 1) return false;
  }

  return true;
}

/** 解鎖/升級天賦 */
export function unlockTalent(data: TalentSaveData, talentId: TalentId): boolean {
  if (!canUnlockTalent(data, talentId)) return false;

  const node = TALENT_TREE.find(t => t.id === talentId);
  if (!node) return false;

  data.spentTalentPoints += node.cost;
  data.talentLevels[talentId] = (data.talentLevels[talentId] || 0) + 1;
  saveTalentData(data);
  return true;
}

/** 計算波次結算天賦點（雙軌制）
 *  Track A（一般關卡/低 Ascension）：僅基數，無額外獎勵
 *  Track B（挑戰關卡/高 Ascension）：基數 + PB 突破 + 里程碑首次獎勵
 */
export function calcTalentPointsEarned(
  survivedWaves: number,
  personalBest: number = 0,
  milestones: number[] = [],
  isChallengeRun: boolean = false
): number {
  // 基數：wave/4，保底 1
  let points = Math.max(1, Math.floor(survivedWaves / 4));

  if (isChallengeRun) {
    // PB 突破獎勵：每超越 2 波多 1 點
    if (survivedWaves > personalBest) {
      points += Math.floor((survivedWaves - personalBest) / 2);
    }
    // 里程碑首次獎勵（各一次）
    for (const m of [5, 10, 15, 20]) {
      if (survivedWaves >= m && !milestones.includes(m)) {
        points += 3;
      }
    }
  }

  return points;
}

/** 加入天賦點 */
export function addTalentPoints(data: TalentSaveData, points: number): void {
  data.totalTalentPoints += points;
  saveTalentData(data);
}

// --- 天賦效果查詢函數 ---

/** 取得基地初始 HP（受天賦影響） */
export function getBaseHP(data: TalentSaveData): number {
  let hp = 20;
  hp += (data.talentLevels['fortress_1'] || 0) * 5;
  hp += (data.talentLevels['fortress_2'] || 0) * 10;
  return hp;
}

/** 取得開局金幣（受天賦影響）
 *  P2 耦合調整：加入 200g 軟上限，避免高天賦玩家開局資源過剩破壞早期建設張力
 */
export function getStartGold(data: TalentSaveData): number {
  let gold = 60;
  gold += (data.talentLevels['gold_1'] || 0) * 20;
  gold += (data.talentLevels['gold_2'] || 0) * 30;
  return Math.min(200, gold); // soft cap：防止全滿天賦開局 310g 破壞早期張力
}

/** 取得砲台基礎傷害倍率（受天賦影響） */
export function getDamageMultiplier(data: TalentSaveData): number {
  let mult = 1.0;
  mult += (data.talentLevels['precise_1'] || 0) * 0.10;
  mult += (data.talentLevels['precise_2'] || 0) * 0.15;
  return mult;
}

/** 取得特定元素砲台的加成倍率 */
export function getTowerElementDamageMultiplier(data: TalentSaveData, element: Element): number {
  let mult = 1.0;
  const mapping: Record<Element, TalentId> = {
    'wood': 'wood_awakening',
    'water': 'water_awakening',
    'fire': 'fire_awakening',
    'earth': 'earth_awakening',
    'metal': 'metal_awakening',
    'yin': 'yin_law',
    'yang': 'yang_law'
  };
  const tid = mapping[element];
  if (tid) {
    mult += (data.talentLevels[tid] || 0) * 0.10;
  }
  return mult;
}

/** 取得砲台射速倍率（受天賦影響，值越小表示射速越快） */
export function getFireRateMultiplier(data: TalentSaveData): number {
  let mult = 1.0;
  // 每級急速射擊冷卻 -5%，最大 5 級
  mult -= (data.talentLevels['rapid_fire'] || 0) * 0.05;
  return Math.max(0.5, mult); // 限制最低 0.5 倍冷卻 (射速加倍)
}

/** 檢查某五行/陰陽砲台是否已解鎖 */
export function isTowerUnlocked(data: TalentSaveData, towerId: string): boolean {
  // 預設解鎖的砲台 (不需要天賦): earth (岩壁塔) 與 fire (烈焰塔)
  if (towerId === 'earth' || towerId === 'fire') return true;

  const unlockMap: Record<string, TalentId> = {
    'water': 'water_awakening',
    'wood': 'wood_awakening',
    'metal': 'metal_awakening',
    'yin': 'yin_law',
    'yang': 'yang_law'
  };

  const requiredTalent = unlockMap[towerId];
  if (!requiredTalent) return true; // 合成塔只要其材料解鎖即可，故直接回傳 true
  return (data.talentLevels[requiredTalent] || 0) >= 1;
}

/** 重置所有天賦（退回所有已花費的點數） */
export function resetTalents(data: TalentSaveData): void {
  data.spentTalentPoints = 0;
  data.talentLevels = {} as Record<TalentId, number>;
  data.resetCount = (data.resetCount || 0) + 1;
  saveTalentData(data);
}

/**
 * P1 耦合調整：根據已花費天賦點數計算怪物 HP 修正因子。
 * 天賦越強的玩家，面對的怪物 HP 越高（最高 +50%），形成自然難度補償。
 *
 * 公式：mod = spentPoints / SPENT_MAX * MAX_BOOST
 * - SPENT_MAX = 85 （估算滿樹所需天賦點）
 * - MAX_BOOST = 0.50 （最多 +50%）
 *
 * 例：已花費 40 點 → mod ≈ 0.235 → 怪物 HP ×1.235
 */
export function getTalentDifficultyMod(data: TalentSaveData): number {
  const SPENT_MAX = 85;  // 所有天賦節點滿等的估算總點數
  const MAX_BOOST = 0.50; // 最高額外 HP 加成
  const spent = data.spentTalentPoints || 0;
  return (Math.min(spent, SPENT_MAX) / SPENT_MAX) * MAX_BOOST;
}

/** 取得岩壁塔（牆壁）造價（受天賦影響） */
export function getWallCost(data: TalentSaveData): number {
  const level = data.talentLevels['wall_discount'] || 0;
  if (level >= 1) return 1;
  return 2;
}

/** P2: 標記已見過怪物詞條（僅首次有效），回傳 true 表示首次記錄 */
export function markTraitSeen(data: TalentSaveData, trait: 'armor' | 'regen' | 'split'): boolean {
  if (!data.seenTraits) data.seenTraits = {};
  if (data.seenTraits[trait]) return false;
  data.seenTraits[trait] = true;
  saveTalentData(data);
  return true;
}

/** P2: 查詢是否已見過指定怪物詞條 */
export function isTraitSeen(data: TalentSaveData, trait: 'armor' | 'regen' | 'split'): boolean {
  return !!(data.seenTraits && data.seenTraits[trait]);
}
