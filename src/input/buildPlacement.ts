import type { Point } from '../types';

export const BUILD_TOOL_IDS = ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'] as const;

export function isBuildTool(tool: string): boolean {
  return BUILD_TOOL_IDS.includes(tool as (typeof BUILD_TOOL_IDS)[number]);
}

export function shouldCommitTowerDrag(
  start: Point | null,
  end: Point,
  releasedOnCanvas: boolean,
  threshold = 5,
): boolean {
  if (!start || !releasedOnCanvas) return false;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return dx * dx + dy * dy > threshold * threshold;
}
