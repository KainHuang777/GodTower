// ============================================================
// src/goals/types.ts — P3 Gate B 目標系統型別定義
// ============================================================
//
// 純型別模組，不依賴 DOM、不依賴 gameState，可被任意層級安全 import。
// 邏輯層 (state.ts / migrate.ts) 與渲染層 (ui/goal*.ts) 共用此契約。

import type { TalentSaveData } from '../talent';

/** 目標 id，以 snake_case 字串表示，與 goals.json 對應 */
export type GoalId = string;

/** 目標分類，僅作 UI 群組顯示用，不影響完成判定 */
export type GoalCategory =
  | 'survival'
  | 'combat'
  | 'synthesis'
  | 'element'
  | 'restriction'
  | 'speed'
  | 'ascension';

/** 完成判定的資料鍵值；對應 RunStats 中的單一欄位 */
export type GoalCompletionKey =
  | 'highestWave'      // 當前存活波次
  | 'clearedAllWaves'  // 通過最終波 (1 = 已通關)
  | 'mergeCount'       // 單局合成次數
  | 'wuxingElementCount' // 已建造的五行元素種類數 (非 0 即 fire/water/wood/metal/earth)
  | 'combatTowerCount'    // 非純牆的「實戰塔」數量 (damage > 0)
  | 'clearTimeMinutes'    // 通關花費分鐘
  | 'ascensionLevel'      // 結算時的 Ascension 層級
  | 'killCount';          // 單局擊殺數

/** 比較運算子；value 為設定的門檻值 */
export type GoalOperator = 'gte' | 'lte' | 'eq';

/** 目標完成條件 */
export interface GoalCompletion {
  /** RunStats 對應欄位 */
  key: GoalCompletionKey;
  /** 比較方式 */
  operator: GoalOperator;
  /** 門檻值 */
  value: number;
  /** 是否要求該局為通關 (isVictory=true) 才能成立 */
  requiresVictory?: boolean;
}

/** 目標定義（資料驅動，由 goals.json 載入） */
export interface GoalDefinition {
  /** 唯一 id */
  id: GoalId;
  /** UI 顯示文案（fallback 用，未來可改 textKey + i18n 字典） */
  label: string;
  /** 玩家可讀的完成條件描述 */
  description: string;
  /** 卡片 emoji icon（美術產線接管前先以 emoji 占位） */
  emoji: string;
  /** UI 群組分類 */
  category: GoalCategory;
  /** 完成判定 */
  completion: GoalCompletion;
  /** 解鎖條件；缺欄位表示無門檻 */
  unlock?: {
    minAscension?: number;
    minRunsCompleted?: number;
  };
}

/** 目標設定檔（goals.json 的對應型別） */
export interface GoalConfig {
  /** 版本戳，用於舊存檔 migration 與失效 id 偵測 */
  version: string;
  /** 目標清單 */
  goals: GoalDefinition[];
}

/** 單一目標的跨局統計 */
export interface GoalStats {
  /** 累計嘗試次數 */
  attempts: number;
  /** 最近一次結果；尚未嘗試時為 null */
  lastResult: GoalRunResult | null;
  /** 最近一次嘗試的時間戳（Date.now()），尚未嘗試時為 null */
  lastAttemptAt: number | null;
  /** 本目標歷史最高存活波次 */
  bestWave: number;
  /** 本目標是否曾被完成過（一旦 true 即不再回退） */
  completed: boolean;
}

/** 單局對單一目標的結果分類 */
export type GoalRunResult = 'success' | 'failure' | 'abandoned';

/** 結算跨局寫入前，由戰鬥層收集的本局統計快照 */
export interface RunStats {
  /** 當前存活波次 */
  highestWave: number;
  /** 通關旗標（1=通關，0=未通關）；與 GoalCompletionKey 對應 */
  clearedAllWaves: number;
  /** 是否通關（通過最終波） */
  isVictory: boolean;
  /** 單局合成次數 */
  mergeCount: number;
  /** 單局已建造的五行元素種類數（fire/water/wood/metal/earth 去重） */
  wuxingElementCount: number;
  /** 單局結算時「實戰塔」（damage > 0）數量 */
  combatTowerCount: number;
  /** 通關花費分鐘（未通關時為 0 或實際局內時間） */
  clearTimeMinutes: number;
  /** 結算時的 Ascension 層級 */
  ascensionLevel: number;
  /** 單局擊殺數 */
  killCount: number;
}

/** 紀錄板渲染快照；由 buildBoardSnapshot 產出，供 UI 直接取用 */
export interface BoardSnapshot {
  /** 結算時正在挑戰的目標 id（無則為 null） */
  currentGoalId: GoalId | null;
  /** 該目標目前累計嘗試次數 */
  attempts: number;
  /** 最近一次結果 */
  lastResult: GoalRunResult | null;
  /** 該目標歷史最高波次 */
  lastBestWave: number;
  /** 該目標是否已達成 */
  completed: boolean;
  /** 本局是否成功完成該目標（供 UI 顯示「剛剛達成」徽章） */
  justAchieved: boolean;
  /** 快照產生時的目標版本戳 */
  version: string;
}

/** 起卦儀式動畫生命週回呼；由邏輯層註冊，動畫層觸發 */
export interface RitualCallbacks {
  /** 開始播放時調用，傳入當前下次目標 id */
  onRitualStart: (goalId: GoalId | null) => void;
  /** 結束時調用；skipped=true 表示玩家主動跳過 */
  onRitualEnd: (skipped: boolean) => void;
  /** 載入或播放失敗時調用 */
  onRitualError: (error: { phase: 'load' | 'play'; message: string }) => void;
}

/** 動畫資源提供者介面；美術產線（Codex）後續填入實際素材 */
export interface RitualAssetProvider {
  /** 載入動畫資源；失敗時 reject */
  loadAssets: () => Promise<void>;
  /** 於指定容器播放動畫 */
  play: (container: HTMLElement) => void;
  /** 釋放資源；切換場景或跳過後必須調用 */
  cleanup: () => void;
}

/** 起卦儀式設定 */
export interface RitualSettings {
  /** 是否啟用；玩家可在設定關閉。預設 true */
  enabled: boolean;
  /** 跳過鍵綁；預設 'Space' */
  skipKeyBind: string;
  /** placeholder（無素材）時顯示毫秒數；預設 2000 */
  fallbackDurationMs: number;
}

/** TalentSaveData 中目標相關欄位的子集合（供 migrate 純函式操作） */
export type GoalSaveDataSlice = Pick<
  TalentSaveData,
  'nextGoalId' | 'nextGoalVersion' | 'goalStats' | 'goalMilestones' | 'lastBoardSnapshot' | 'mainMenuSeenGoalId' | 'ritualEnabled'
>;

/** 空的 BoardSnapshot（用於初始化與舊存檔補欄位） */
export function createEmptyBoardSnapshot(): BoardSnapshot {
  return {
    currentGoalId: null,
    attempts: 0,
    lastResult: null,
    lastBestWave: 0,
    completed: false,
    justAchieved: false,
    version: '',
  };
}