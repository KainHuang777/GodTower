import type { TalentSaveData } from '../talent';
import type { BestiarySaveData, AchievementProgress } from './types';
import { getAllAchievements, getAllBestiaryEntries } from './config';

function ensureBestiary(data: TalentSaveData): BestiarySaveData {
  if (!data.collectionBestiary) {
    data.collectionBestiary = { enemies: {}, towers: {}, traits: {} };
  } else {
    if (!data.collectionBestiary.enemies) data.collectionBestiary.enemies = {};
    if (!data.collectionBestiary.towers) data.collectionBestiary.towers = {};
    if (!data.collectionBestiary.traits) data.collectionBestiary.traits = {};
  }
  return data.collectionBestiary;
}

function ensureProgress(data: TalentSaveData): AchievementProgress {
  if (!data.collectionProgress) {
    data.collectionProgress = { totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0, highestAscension: 0, totalTaijiMerges: 0, noWallCompletions: 0, singleElementCompletions: 0, maxConsecutivePerfectWaves: 0 };
  }
  return data.collectionProgress;
}

export function recordKill(data: TalentSaveData, enemyTypeId: string, isBoss: boolean): void {
  markEnemySeen(data, enemyTypeId);
  addKill(data);
  if (isBoss) {
    const p = ensureProgress(data);
    p.bossKills++;
  }
}

export function markEnemySeen(data: TalentSaveData, enemyTypeId: string): boolean {
  const bestiary = ensureBestiary(data);
  if (bestiary.enemies[enemyTypeId]) return false;
  bestiary.enemies[enemyTypeId] = true;
  return true;
}

export function markTowerCrafted(data: TalentSaveData, towerTypeId: string): boolean {
  const bestiary = ensureBestiary(data);
  if (bestiary.towers[towerTypeId]) return false;
  bestiary.towers[towerTypeId] = true;
  return true;
}

export function isEnemySeen(data: TalentSaveData, enemyTypeId: string): boolean {
  return !!data.collectionBestiary?.enemies?.[enemyTypeId];
}

export function isTowerCrafted(data: TalentSaveData, towerTypeId: string): boolean {
  return !!data.collectionBestiary?.towers?.[towerTypeId];
}

export function addKill(data: TalentSaveData): void {
  ensureProgress(data);
  data.collectionProgress!.totalKills++;
}

export function addMerge(data: TalentSaveData): void {
  ensureProgress(data);
  data.collectionProgress!.totalMerges++;
}

export function addTaijiMerge(data: TalentSaveData): void {
  ensureProgress(data);
  data.collectionProgress!.totalTaijiMerges++;
}

export function updateHighestAscension(data: TalentSaveData, ascensionLevel: number): void {
  const p = ensureProgress(data);
  if (ascensionLevel > p.highestAscension) p.highestAscension = ascensionLevel;
}

export function updateNoWallCompletion(data: TalentSaveData): void {
  ensureProgress(data);
  data.collectionProgress!.noWallCompletions++;
}

export function updateSingleElementCompletion(data: TalentSaveData): void {
  ensureProgress(data);
  data.collectionProgress!.singleElementCompletions++;
}

export function updateMaxConsecutivePerfectWaves(data: TalentSaveData, streak: number): void {
  const p = ensureProgress(data);
  if (streak > p.maxConsecutivePerfectWaves) p.maxConsecutivePerfectWaves = streak;
}

export function updateEndOfRunStats(data: TalentSaveData, isVictory: boolean, highestWave: number): void {
  const p = ensureProgress(data);
  if (isVictory) p.totalVictories++;
  else p.totalDefeats++;
  if (highestWave > p.highestWave) p.highestWave = highestWave;
}

export function evaluateAchievements(data: TalentSaveData): string[] {
  const progress = ensureProgress(data);
  if (!data.collectionCompleted) data.collectionCompleted = [];
  const completed = new Set(data.collectionCompleted);
  const newlyCompleted: string[] = [];

  const bestiary = data.collectionBestiary ?? { enemies: {}, towers: {}, traits: {} };
  const allEntries = getAllBestiaryEntries();

  for (const ach of getAllAchievements()) {
    if (completed.has(ach.id)) continue;

    let value = 0;
    switch (ach.condition.key) {
      case 'totalKills': value = progress.totalKills; break;
      case 'totalMerges': value = progress.totalMerges; break;
      case 'totalVictories': value = progress.totalVictories; break;
      case 'highestWave': value = progress.highestWave; break;
      case 'bossKills': value = progress.bossKills; break;
      case 'totalDefeats': value = progress.totalDefeats; break;
      case 'recipesDiscovered': {
        value = allEntries.filter(e => e.category === 'tower' && e.recipe === true)
          .map(e => e.id).filter(id => bestiary.towers[id]).length;
        break;
      }
      case 'talentPointsSpent': value = data.spentTalentPoints ?? 0; break;
      case 'highestAscension': value = progress.highestAscension; break;
      case 'totalTaijiMerges': value = progress.totalTaijiMerges; break;
      case 'noWallCompletions': value = progress.noWallCompletions; break;
      case 'singleElementCompletions': value = progress.singleElementCompletions; break;
      case 'maxConsecutivePerfectWaves': value = progress.maxConsecutivePerfectWaves; break;
      case 'lv2TowersUnlocked': {
        value = allEntries.filter(e => e.category === 'tower' && e.level != null && e.level >= 2 && !e.recipe)
          .map(e => e.id).filter(id => bestiary.towers[id]).length;
        break;
      }
    }

    let met = false;
    switch (ach.condition.op) {
      case 'gte': met = value >= ach.condition.value; break;
      case 'lte': met = value <= ach.condition.value; break;
      case 'eq': met = value === ach.condition.value; break;
    }

    if (ach.condition.requiresVictory && (!progress.totalVictories || progress.totalVictories < 1)) {
      met = false;
    }

    if (met) {
      completed.add(ach.id);
      data.collectionCompleted!.push(ach.id);
      newlyCompleted.push(ach.id);
    }
  }

  return newlyCompleted;
}

export function getBestiaryUnlockedCount(data: TalentSaveData): { enemies: number; towers: number; traits: number; total: number } {
  const b = data.collectionBestiary ?? { enemies: {}, towers: {}, traits: {} };
  const enemyCount = Object.keys(b.enemies).length;
  const towerCount = Object.keys(b.towers).length;
  const traitCount = Object.keys(b.traits).length;
  return { enemies: enemyCount, towers: towerCount, traits: traitCount, total: enemyCount + towerCount + traitCount };
}

export function getAchievementProgress(data: TalentSaveData): { completed: number; total: number } {
  const total = getAllAchievements().length;
  const completed = data.collectionCompleted?.length ?? 0;
  return { completed, total };
}
