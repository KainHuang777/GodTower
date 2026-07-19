// ============================================================
// src/talent.ts — 天賦樹定義、平台抽象存檔持久化
// ============================================================

import { currentSaveStorage } from './system/platform';
import type { Element } from './towers';
import { ensureGoalFields, reconcileGoalStats } from './goals/migrate';
import { getGoalConfigVersion } from './goals/config';
import { createEmptyBoardSnapshot } from './goals/types';
import { ensureCollectionFields } from './collection/migrate';
import type { AchievementProgress } from './collection/types';

const STORAGE_KEY = 'td_talent_data';
const LEGACY_STORAGE_KEYS = ['checkpoint_maze_td_talent'] as const;

/** 天賦節點 ID */
export type TalentId =
  | 'fortress_1' | 'fortress_2'
  | 'gold_1' | 'gold_2'
  | 'precise_1' | 'precise_2' | 'rapid_fire'
  | 'wood_awakening' | 'water_awakening' | 'fire_awakening' | 'earth_awakening' | 'metal_awakening'
  | 'yin_law' | 'yang_law' | 'taiji_dao'
  | 'wall_discount';

export type TalentTrackId = 'track-base' | 'track-attack' | 'track-element' | 'track-yinyang';
export type TalentOrgan = '肝' | '心' | '脾' | '肺' | '腎';
export type TalentVisualTheme = 'du' | 'ren' | 'qi' | 'wood' | 'fire' | 'earth' | 'metal' | 'water' | 'yin' | 'yang' | 'taiji';

export const TALENT_TRACK_TALENTS: Record<TalentTrackId, TalentId[]> = {
  'track-base': ['fortress_1', 'fortress_2', 'gold_1', 'gold_2'],
  'track-attack': ['precise_1', 'precise_2', 'rapid_fire'],
  'track-element': ['wood_awakening', 'water_awakening', 'fire_awakening', 'earth_awakening', 'wall_discount', 'metal_awakening'],
  'track-yinyang': ['yin_law', 'yang_law', 'taiji_dao']
};

export const TALENT_TRACK_UNLOCK_POINTS: Record<TalentTrackId, number> = {
  'track-base': 0,
  'track-attack': 2,
  'track-element': 6,
  'track-yinyang': 12
};

/**
 * 顯示主題以 TalentId 明確對應，不從 ID 字串猜測。
 * 這是 DOM、CSS 與後續 SVG 連線共用的單一來源。
 */
export const TALENT_THEME_BY_ID: Record<TalentId, TalentVisualTheme> = {
  fortress_1: 'du', fortress_2: 'du',
  gold_1: 'ren', gold_2: 'ren',
  precise_1: 'qi', precise_2: 'qi', rapid_fire: 'qi',
  wood_awakening: 'wood', water_awakening: 'water', fire_awakening: 'fire',
  earth_awakening: 'earth', wall_discount: 'earth', metal_awakening: 'metal',
  yin_law: 'yin', yang_law: 'yang', taiji_dao: 'taiji'
};

/** 天賦節點定義 */
export interface TalentNode {
  id: TalentId;
  name: string;
  description: string;
  displayName: string;    // 古典主名，只用於顯示層
  mechanicLabel: string;  // 白話機制副標
  classicAllusion: string;// 典故取意，不作醫療陳述
  sourceRef: string;      // 原典或「遊戲化創作」來源標示
  visualTheme: TalentVisualTheme;
  cost: number;           // 每次升級需要的天賦點
  prerequisites: TalentId[]; // 前置天賦
  category: 'base' | 'attack' | 'element' | 'yinyang';
  maxLevel: number;       // 最大等級
  organ?: TalentOrgan;
}

function defineTalent(node: Omit<TalentNode, 'visualTheme'>): TalentNode {
  return { ...node, visualTheme: TALENT_THEME_BY_ID[node.id] };
}

/** 天賦樹完整定義 */
export const TALENT_TREE: TalentNode[] = [
  // 基礎強化路線
  defineTalent({ id: 'fortress_1', name: '堅固堡壘 I', description: '每級基地生命 +5', displayName: '督脈固關', mechanicLabel: '基地生命 +5／級', classicAllusion: '取意督脈總督諸陽，以固關轉譯基地防護。', sourceRef: '後世奇經八脈學說（遊戲化取意）', cost: 2, prerequisites: [], category: 'base', maxLevel: 5 }),
  defineTalent({ id: 'fortress_2', name: '堅固堡壘 II', description: '每級基地生命 +10', displayName: '督脈周天', mechanicLabel: '基地生命 +10／級', classicAllusion: '取意督脈循背而行，以周天轉譯防線持續強化。', sourceRef: '後世奇經八脈學說（遊戲化取意）', cost: 2, prerequisites: ['fortress_1'], category: 'base', maxLevel: 5 }),
  defineTalent({ id: 'gold_1', name: '初始資金 I', description: '每級開局金幣 +20', displayName: '任脈養元', mechanicLabel: '開局金幣 +20／級', classicAllusion: '取意任脈總任諸陰，以養元轉譯開局資源。', sourceRef: '後世奇經八脈學說（遊戲化取意）', cost: 2, prerequisites: [], category: 'base', maxLevel: 5 }),
  defineTalent({ id: 'gold_2', name: '初始資金 II', description: '每級開局金幣 +30', displayName: '任脈歸海', mechanicLabel: '開局金幣 +30／級', classicAllusion: '取意任脈歸海的修行意象，轉譯為更充足的開局積蓄。', sourceRef: '後世奇經八脈學說（遊戲化取意）', cost: 2, prerequisites: ['gold_1'], category: 'base', maxLevel: 5 }),

  // 攻擊強化路線
  defineTalent({ id: 'precise_1', name: '精準射擊 I', description: '每級所有砲台傷害 +10%', displayName: '凝神入微', mechanicLabel: '所有砲台傷害 +10%／級', classicAllusion: '凝神入微為遊戲化修行語彙，轉譯砲台命中要害的傷害增幅。', sourceRef: '遊戲化創作（東方修行意象）', cost: 2, prerequisites: [], category: 'attack', maxLevel: 5 }),
  defineTalent({ id: 'precise_2', name: '精準射擊 II', description: '每級所有砲台傷害 +15%', displayName: '神會於刃', mechanicLabel: '所有砲台傷害 +15%／級', classicAllusion: '以心神與鋒刃相會的意象，轉譯更高階的全局傷害強化。', sourceRef: '遊戲化創作（東方修行意象）', cost: 2, prerequisites: ['precise_1'], category: 'attack', maxLevel: 5 }),
  defineTalent({ id: 'rapid_fire', name: '急速射擊', description: '每級所有砲台冷卻時間 -5%', displayName: '氣行如流', mechanicLabel: '所有砲台冷卻 -5%／級', classicAllusion: '取意營衛周流的意象，轉譯砲台更緊密的攻擊節奏。', sourceRef: '《靈樞・營衛生會》（取意）', cost: 3, prerequisites: ['precise_1'], category: 'attack', maxLevel: 5 }),

  // 五行解鎖路線
  defineTalent({ id: 'wood_awakening', name: '木行覺醒', description: '解鎖纏繞塔 🌿，每級木系塔傷害 +10%', displayName: '肝木疏達', mechanicLabel: '解鎖纏繞塔；木系傷害 +10%／級', classicAllusion: '肝為將軍之官，謀慮出焉；此處取意為佈局、控場與持續傷害。', sourceRef: '《素問・靈蘭秘典論》（取意）', cost: 2, prerequisites: [], category: 'element', maxLevel: 5, organ: '肝' }),
  defineTalent({ id: 'water_awakening', name: '水行覺醒', description: '解鎖冰凍塔 💧，每級水系塔傷害 +10%', displayName: '腎水藏精', mechanicLabel: '解鎖冰凍塔；水系傷害 +10%／級', classicAllusion: '腎為作強之官，技巧出焉；此處取意為減速、蓄勢與持久。', sourceRef: '《素問・靈蘭秘典論》（取意）', cost: 2, prerequisites: [], category: 'element', maxLevel: 5, organ: '腎' }),
  defineTalent({ id: 'fire_awakening', name: '火行覺醒', description: '強化烈焰塔 🔥，每級火系塔傷害 +10% (火系預設解鎖)', displayName: '心火昭明', mechanicLabel: '強化烈焰塔；火系傷害 +10%／級', classicAllusion: '心為君主之官，神明出焉；此處取意為爆發、節奏與主動強化。', sourceRef: '《素問・靈蘭秘典論》（取意）', cost: 2, prerequisites: [], category: 'element', maxLevel: 5, organ: '心' }),
  defineTalent({ id: 'earth_awakening', name: '土行覺醒', description: '強化岩壁塔 ⛰️，每級土系塔效果/傷害 +10% (土系預設解鎖)', displayName: '脾土運化', mechanicLabel: '強化岩壁塔；土系效果／傷害 +10%／級', classicAllusion: '脾胃為倉廩之官，五味出焉；此處取意為築防、資源與穩定。', sourceRef: '《素問・靈蘭秘典論》（取意）', cost: 2, prerequisites: [], category: 'element', maxLevel: 5, organ: '脾' }),
  defineTalent({ id: 'wall_discount', name: '築牆工法', description: '使岩壁塔（牆壁）的造價降低至 1g (預設為 2g)', displayName: '脾土築垣', mechanicLabel: '岩壁塔造價 2g → 1g', classicAllusion: '延伸脾土運化的遊戲轉譯，以更少資源延展岩壁迷宮。', sourceRef: '《素問・靈蘭秘典論》（取意）', cost: 2, prerequisites: ['earth_awakening'], category: 'element', maxLevel: 1, organ: '脾' }),
  defineTalent({ id: 'metal_awakening', name: '金行覺醒', description: '解鎖鏡刃塔 ⚔️，每級金系塔傷害 +10%', displayName: '肺金肅降', mechanicLabel: '解鎖鏡刃塔；金系傷害 +10%／級', classicAllusion: '肺為相傅之官，治節出焉；此處取意為精準、穿透與規律。', sourceRef: '《素問・靈蘭秘典論》（取意）', cost: 2, prerequisites: [], category: 'element', maxLevel: 5, organ: '肺' }),

  // 陰陽解鎖路線
  defineTalent({ id: 'yin_law', name: '陰之法則', description: '解鎖暗影塔 🌑，每級陰系塔傷害 +10%', displayName: '陰儀藏影', mechanicLabel: '解鎖暗影塔；陰系傷害 +10%／級', classicAllusion: '取意陰平陽秘的平衡意象，將陰儀轉譯為暗影塔路線。', sourceRef: '《素問・生氣通天論》（取意）', cost: 3, prerequisites: [], category: 'yinyang', maxLevel: 5 }),
  defineTalent({ id: 'yang_law', name: '陽之法則', description: '解鎖聖光塔 ☀️，每級陽系塔傷害 +10%', displayName: '陽儀昭明', mechanicLabel: '解鎖聖光塔；陽系傷害 +10%／級', classicAllusion: '取意陰平陽秘的平衡意象，將陽儀轉譯為聖光塔路線。', sourceRef: '《素問・生氣通天論》（取意）', cost: 3, prerequisites: [], category: 'yinyang', maxLevel: 5 }),
  defineTalent({ id: 'taiji_dao', name: '太極之道', description: '解鎖陰陽合成配方 ☯️，每級太極塔傷害 +10%', displayName: '兩儀歸太極', mechanicLabel: '解鎖陰陽合成；太極塔傷害 +10%／級', classicAllusion: '取意《周易・繫辭上》的太極與兩儀意象，轉譯為陰陽合成。', sourceRef: '《周易・繫辭上》（易象取意）', cost: 5, prerequisites: ['yin_law', 'yang_law'], category: 'yinyang', maxLevel: 5 }),
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
  /** F10：正式關卡通關次數（非 test_level/tutorial），用於目標解鎖條件計算 */
  formalRunsCompleted?: number;
  seenTraits?: { armor?: boolean; regen?: boolean; split?: boolean }; // P2: 已見過的怪物詞條

  // --- P3 Gate B：下次目標系統（全 optional，舊存檔透過 ensureGoalFields 補預設） ---
  /** 玩家勾選的下次挑戰目標 id；null 表示未選 */
  nextGoalId?: string | null;
  /** 目標設定檔版本戳；與 GOAL_CONFIG.version 不同時觸發 reconcileGoalStats */
  nextGoalVersion?: string;
  /** 各目標跨局統計；key = GoalId */
  goalStats?: Record<string, import('./goals/types').GoalStats>;
  /** 本輪新增的波次門檻里程碑（與既有 milestones 區隔：里程碑成就是另一軌） */
  goalMilestones?: number[];
  /** 紀錄板最近一次渲染快照 */
  lastBoardSnapshot?: import('./goals/types').BoardSnapshot;
  /** 主選單上次顯示的目標 id，避免動畫重播 */
  mainMenuSeenGoalId?: string | null;
  /** 起卦儀式動畫開關；預設 true */
  ritualEnabled?: boolean;

  // --- 圖鑑＋成就系統（P0 Codex） ---
  collectionBestiary?: { enemies: Record<string, boolean>; towers: Record<string, boolean>; traits: Record<string, boolean> };
  collectionProgress?: AchievementProgress;
  collectionCompleted?: string[];
}

/**
 * 分支依玩家歷史累積點數逐步開放；已在分支投資的舊存檔永遠保持開放。
 * 使用 totalTalentPoints 而非 spentTalentPoints，確保重置天賦不會倒退敘事進度。
 */
export function isTalentTrackUnlocked(data: TalentSaveData, trackId: TalentTrackId): boolean {
  const alreadyInvested = TALENT_TRACK_TALENTS[trackId].some(
    talentId => (data.talentLevels[talentId] || 0) > 0
  );
  return alreadyInvested || data.totalTalentPoints >= TALENT_TRACK_UNLOCK_POINTS[trackId];
}

/** 從 platform 載入天賦資料 */
export function loadTalentData(): TalentSaveData {
  const storageKeys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const storageKey of storageKeys) {
    try {
      const raw = currentSaveStorage.getItem(storageKey);
      if (!raw) continue;

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

        // P3 Gate B：補上目標系統欄位，並驗證失效目標 id
        ensureGoalFields(parsed as TalentSaveData);
        // 圖鑑＋成就系統：補上 collection 相關欄位
        ensureCollectionFields(parsed as TalentSaveData);
        // 版本戳不同時清理 goalStats 中已刪除的目標 id
        if ((parsed as TalentSaveData).nextGoalVersion !== getGoalConfigVersion()) {
          reconcileGoalStats(parsed as TalentSaveData);
        }
        return parsed as TalentSaveData;
      }
    } catch { /* 單一 key 損毀時繼續嘗試舊 key */ }
  }

  const fresh: TalentSaveData = {
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
    formalRunsCompleted: 0,
    nextGoalId: null,
    nextGoalVersion: getGoalConfigVersion(),
    goalStats: {},
    goalMilestones: [],
    lastBoardSnapshot: createEmptyBoardSnapshot(),
    mainMenuSeenGoalId: null,
    ritualEnabled: true,
    collectionBestiary: { enemies: {}, towers: {}, traits: {} },
    collectionProgress: { totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0, highestAscension: 0, totalTaijiMerges: 0, noWallCompletions: 0, singleElementCompletions: 0, maxConsecutivePerfectWaves: 0 },
    collectionCompleted: [],
  };
  return fresh;
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
