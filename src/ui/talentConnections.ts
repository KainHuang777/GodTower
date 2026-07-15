import {
  TALENT_THEME_BY_ID,
  TALENT_TREE,
  canUnlockTalent,
  type TalentId,
  type TalentSaveData,
  type TalentVisualTheme,
} from '../talent';

export type TalentConnectionKind = 'meridian' | 'branch' | 'convergence' | 'outer';
export type TalentConnectionState = 'maxed' | 'active' | 'available' | 'locked';
export type TalentOuterSealId = 'outer-wood' | 'outer-fire' | 'outer-earth' | 'outer-metal' | 'outer-water';
export type TalentConnectionTarget = TalentId | TalentOuterSealId;
export type TalentSealMotif = 'fortress' | 'wall' | 'wealth' | 'precision' | 'blade' | 'flow' | 'wood' | 'fire' | 'earth' | 'metal' | 'water' | 'yin' | 'yang' | 'taiji';

export interface TalentConnectionDefinition {
  from: TalentId;
  to: TalentConnectionTarget;
  theme: TalentVisualTheme;
  kind: TalentConnectionKind;
}

export interface TalentOuterSealDefinition {
  id: TalentOuterSealId;
  theme: Extract<TalentVisualTheme, 'wood' | 'fire' | 'earth' | 'metal' | 'water'>;
  motif: Extract<TalentSealMotif, 'wood' | 'fire' | 'earth' | 'metal' | 'water'>;
  label: string;
}

export interface TalentConnectionPoint {
  x: number;
  y: number;
}

const CONNECTION_KIND_BY_TARGET: Partial<Record<TalentId, TalentConnectionKind>> = {
  rapid_fire: 'branch',
  wall_discount: 'branch',
  taiji_dao: 'convergence',
};

const TALENT_PREREQUISITE_CONNECTIONS: TalentConnectionDefinition[] = TALENT_TREE.flatMap(node =>
  node.prerequisites.map(from => ({
    from,
    to: node.id,
    theme: TALENT_THEME_BY_ID[from],
    kind: CONNECTION_KIND_BY_TARGET[node.id] ?? 'meridian',
  })),
);

/**
 * P2-D 的可視連線資料。真實前置關係與未開放外章分開標記，
 * 避免裝飾節點被誤認為可操作天賦。
 */
export const TALENT_CONNECTIONS: readonly TalentConnectionDefinition[] = [
  ...TALENT_PREREQUISITE_CONNECTIONS,
  { from: 'wood_awakening', to: 'outer-wood', theme: 'wood', kind: 'outer' },
  { from: 'fire_awakening', to: 'outer-fire', theme: 'fire', kind: 'outer' },
  { from: 'earth_awakening', to: 'outer-earth', theme: 'earth', kind: 'outer' },
  { from: 'metal_awakening', to: 'outer-metal', theme: 'metal', kind: 'outer' },
  { from: 'water_awakening', to: 'outer-water', theme: 'water', kind: 'outer' },
] as const;

export const TALENT_OUTER_SEALS: readonly TalentOuterSealDefinition[] = [
  { id: 'outer-wood', theme: 'wood', motif: 'wood', label: '木行外章' },
  { id: 'outer-fire', theme: 'fire', motif: 'fire', label: '火行外章' },
  { id: 'outer-earth', theme: 'earth', motif: 'earth', label: '土行外章' },
  { id: 'outer-metal', theme: 'metal', motif: 'metal', label: '金行外章' },
  { id: 'outer-water', theme: 'water', motif: 'water', label: '水行外章' },
] as const;

export function isTalentOuterSealId(target: TalentConnectionTarget): target is TalentOuterSealId {
  return target.startsWith('outer-');
}

/**
 * 實線表示目標已啟用；可學習路徑保留主題色與金色節律；其餘使用鎖定虛線。
 * 外章只作未開放世界觀提示，永遠不進入可學習狀態。
 */
export function getTalentConnectionState(
  data: TalentSaveData,
  connection: TalentConnectionDefinition,
): TalentConnectionState {
  if (connection.kind === 'outer' || isTalentOuterSealId(connection.to)) return 'locked';
  const target = TALENT_TREE.find(node => node.id === connection.to);
  const level = data.talentLevels[connection.to] || 0;
  if (target && level >= target.maxLevel) return 'maxed';
  if (level > 0) return 'active';
  if (canUnlockTalent(data, connection.to)) return 'available';
  return 'locked';
}

export function buildTalentConnectionCurve(
  from: TalentConnectionPoint,
  to: TalentConnectionPoint,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) < 0.01) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  const bend = Math.min(110, Math.max(32, (Math.abs(dx) + Math.abs(dy)) * 0.28));
  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = Math.sign(dx || 1);
    return `M ${from.x} ${from.y} C ${from.x + direction * bend} ${from.y}, ${to.x - direction * bend} ${to.y}, ${to.x} ${to.y}`;
  }

  const direction = Math.sign(dy || 1);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + direction * bend}, ${to.x} ${to.y - direction * bend}, ${to.x} ${to.y}`;
}
