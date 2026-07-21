import type { TalentSaveData } from '../talent';

export type BestiaryCategory = 'enemy' | 'tower' | 'trait';

export interface BestiaryDefinition {
  id: string;
  category: BestiaryCategory;
  label: string;
  element: string;
  lore: string;
  spriteType: string;
  level?: number;
  recipe?: boolean;
}

export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  condition: {
    key: string;
    op: 'gte' | 'lte' | 'eq';
    value: number;
    requiresVictory?: boolean;
  };
}

export interface CollectionConfig {
  version: string;
  bestiary: BestiaryDefinition[];
  achievements: AchievementDefinition[];
}

export interface BestiarySaveData {
  enemies: Record<string, boolean>;
  towers: Record<string, boolean>;
  traits: Record<string, boolean>;
}

export interface AchievementProgress {
  totalKills: number;
  totalMerges: number;
  totalVictories: number;
  highestWave: number;
  bossKills: number;
  totalDefeats: number;
  recipesDiscovered: number;
  highestAscension: number;
  totalTaijiMerges: number;
  noWallCompletions: number;
  singleElementCompletions: number;
  maxConsecutivePerfectWaves: number;
}

export interface CollectionSaveData {
  bestiary: BestiarySaveData;
  achievementProgress: AchievementProgress;
  completedAchievements: string[];
}

export type CollectionSaveDataSlice = Pick<
  TalentSaveData,
  'collectionBestiary' | 'collectionProgress' | 'collectionCompleted'
>;
