// ============================================================
// src/types.ts — 共享型別、介面與常數定義
// ============================================================

import type { EnemyTypeId } from './enemies';
import type { Element, TowerTypeId, TowerDef } from './towers';

export interface Point { x: number; y: number; }

export type GameScene = 'MAIN_MENU' | 'LEVEL_SELECT' | 'MAP_EDITOR' | 'TALENT_SCREEN' | 'BATTLE' | 'GAME_OVER';

export type EditorTool = 'spawn' | 'base' | 'waypoint' | 'obstacle' | 'eraser';

export interface Enemy {
  id: number;
  type: EnemyTypeId;
  element: Element;
  x: number; y: number;
  currentGridX: number; currentGridY: number;
  hp: number; maxHp: number;
  speed: number; baseSpeed: number;
  goldAward: number;
  isFlying: boolean;
  waypointIndex: number;
  path: Point[]; pathIndex: number;
  slowDuration: number;
  dotDamage: number; dotDuration: number;
  hitFlashFrame: number;
  vx: number;
  vy: number;
  squashX: number;
  squashY: number;
  isStuck?: boolean;
  pathBlockedHintShown?: boolean;
  armor?: boolean;
  regen?: boolean;
  split?: boolean;
  hasSplit?: boolean;
  dotSourceTowerId?: number; // P2 tracking for DOT damage source
  dotElement?: Element; // P3 tracking for DOT damage element
}

export interface Tower {
  id: number;
  x: number; y: number;
  typeId: TowerTypeId;
  def: TowerDef;
  cooldown: number;
  recoilY: number;
  damageDealt: number; // P2 tracking for total damage dealt by this tower
}

export interface Bullet {
  x: number; y: number;
  targetEnemy: Enemy;
  speed: number;
  damage: number;
  element: Element;
  slowPct?: number; slowDuration?: number;
  dotDamage?: number; dotDuration?: number;
  aoeRadius?: number; aoeDamagePct?: number;
  hpPctDamage?: number;
  critChance?: number; critMultiplier?: number;
  flyingBonus?: number;
  healBase?: number;
  spawnWall?: boolean;
  sourceTowerId?: number; // P2 tracking for damage credit
  trueDamage?: boolean; // P3 tracking for true damage bypass
}

export interface FloatingText {
  x: number; y: number; text: string; color: string; alpha: number; life: number;
  fontSize?: number;
  isTypewriter?: boolean;
  fullText?: string;
}

export interface TempWall {
  x: number; y: number; lifetime: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  gravity?: number;
  isPixel?: boolean;
  dragMultiplier?: number;
  isRing?: boolean;
  maxRadius?: number;
}

export type ThemeId = 'scifi' | 'chinese' | 'ink' | 'starry';
export type WeatherId = 'none' | 'rain' | 'fog' | 'thunder';

export interface BgStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  length?: number;
}

export const GAME_VERSION = 'V0.40';
export const MAX_WAVES = 20;
