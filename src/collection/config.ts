import collectionConfigJson from '../config/collection.json';
import type { CollectionConfig, BestiaryDefinition, AchievementDefinition } from './types';

export const COLLECTION_CONFIG: CollectionConfig = collectionConfigJson as CollectionConfig;

export function getBestiaryEntryById(id: string): BestiaryDefinition | null {
  return COLLECTION_CONFIG.bestiary.find(e => e.id === id) ?? null;
}

export function getAllBestiaryEntries(): BestiaryDefinition[] {
  return [...COLLECTION_CONFIG.bestiary];
}

export function getAchievementById(id: string): AchievementDefinition | null {
  return COLLECTION_CONFIG.achievements.find(a => a.id === id) ?? null;
}

export function getAllAchievements(): AchievementDefinition[] {
  return [...COLLECTION_CONFIG.achievements];
}

export function getCollectionConfigVersion(): string {
  return COLLECTION_CONFIG.version;
}
