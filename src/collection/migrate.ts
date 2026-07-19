import type { TalentSaveData } from '../talent';

export function ensureCollectionFields(data: TalentSaveData): void {
  if (!data.collectionBestiary || typeof data.collectionBestiary !== 'object') {
    data.collectionBestiary = { enemies: {}, towers: {}, traits: {} };
  }
  if (!data.collectionBestiary.enemies || typeof data.collectionBestiary.enemies !== 'object') {
    data.collectionBestiary.enemies = {};
  }
  if (!data.collectionBestiary.towers || typeof data.collectionBestiary.towers !== 'object') {
    data.collectionBestiary.towers = {};
  }
  if (!data.collectionBestiary.traits || typeof data.collectionBestiary.traits !== 'object') {
    data.collectionBestiary.traits = {};
  }

  // 單次轉換：舊 seenTraits → bestiary.traits
  if (data.seenTraits) {
    if (data.seenTraits.armor) data.collectionBestiary.traits.armor = true;
    if (data.seenTraits.regen) data.collectionBestiary.traits.regen = true;
    if (data.seenTraits.split) data.collectionBestiary.traits.split = true;
  }

  if (!data.collectionProgress || typeof data.collectionProgress !== 'object') {
    data.collectionProgress = { totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0, bossKills: 0, totalDefeats: 0, recipesDiscovered: 0 };
  } else {
    if (typeof data.collectionProgress.bossKills !== 'number') data.collectionProgress.bossKills = 0;
    if (typeof data.collectionProgress.totalDefeats !== 'number') data.collectionProgress.totalDefeats = 0;
    if (typeof data.collectionProgress.recipesDiscovered !== 'number') data.collectionProgress.recipesDiscovered = 0;
  }

  if (!Array.isArray(data.collectionCompleted)) {
    data.collectionCompleted = [];
  }
}
