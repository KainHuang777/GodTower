// src/battle/difficulty.ts — Ascension 難度系統
import { gameState } from '../state';
import type { TalentSaveData } from '../talent';

export interface AscensionConfig {
  level: number;
  name: string;
  monsterHpMult: number;
  monsterSpeedMult: number;
  monsterCountAdd: number;
  startGold: number;
  eliteChance: number;
  bossSkill: boolean;
  specialRules: string[];
  negativeEventChance: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function getAscensionConfig(level: number): AscensionConfig {
  const L = clamp(level, 0, 10);
  return {
    level: L,
    name: `Ascension ${L}`,
    monsterHpMult: 1.0 + L * 0.0875,
    monsterSpeedMult: 1.0 + L * 0.0275,
    monsterCountAdd: 0.05 * Math.floor(L / 2),
    startGold: Math.max(35, 60 - 5 * Math.floor(L / 2)),
    eliteChance: clamp(L * 0.03, 0, 0.4),
    bossSkill: L >= 4,
    specialRules: getAscensionSpecialRules(L),
    negativeEventChance: Math.max(0, (L - 7) * 0.05),
  };
}

export function getAscensionSpecialRules(level: number): string[] {
  const rules: string[] = [];
  if (level >= 2) rules.push('飛行怪提前 1 波出現');
  if (level >= 4) rules.push('Boss 獲得額外技能');
  if (level >= 6) rules.push('每波結束金幣 -15%');
  if (level >= 7) rules.push('隨機負面事件（每 3 波）');
  if (level >= 9) rules.push('怪物獲得 10% 元素抗性');
  return rules;
}

export function applyAscensionModifiers(level: number): void {
  const cfg = getAscensionConfig(level);
  gameState.ascensionHpMult = cfg.monsterHpMult;
  gameState.ascensionSpeedMult = cfg.monsterSpeedMult;
  gameState.ascensionCountAdd = cfg.monsterCountAdd;
  gameState.displayedAscension = cfg.name;
}

export function isAscensionUnlocked(level: number, data: TalentSaveData): boolean {
  if (level === 0) return true;
  if (level < 0 || level > 10) return false;
  return (data.personalBest ?? 0) >= 20;
}

/**
 * P1 耦合調整：根據天賦花費點數返回 Ascension 難度建議提示。
 * 用於在主選單/地圖選擇介面提示高天賦玩家挑戰更高天譴難度，
 * 形成天賦成長 → 難度挑戰的正向循環。
 *
 * @param spentPoints 已花費天賦點數
 * @returns 建議提示字串（空字串表示無提示）
 */
export function getAscensionHintForTalentLevel(spentPoints: number): string {
  if (spentPoints >= 60) {
    return '🔥 天賦精通！建議挑戰 Ascension 5+ 以感受真實挑戰';
  } else if (spentPoints >= 40) {
    return '⚔️ 天賦深厚，建議嘗試 Ascension 3+';
  } else if (spentPoints >= 20) {
    return '💡 已有一定天賦，可試試 Ascension 1-2';
  }
  return '';
}
