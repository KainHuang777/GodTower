import { describe, expect, it } from 'vitest';
import { isBuildTool, shouldCommitTowerDrag } from '../input/buildPlacement';

describe('tower build input guards', () => {
  it('recognizes only the seven placeable base tower tools', () => {
    expect(isBuildTool('earth')).toBe(true);
    expect(isBuildTool('yang')).toBe(true);
    expect(isBuildTool('sell')).toBe(false);
    expect(isBuildTool('')).toBe(false);
  });

  it('does not treat a shop click as a drag placement', () => {
    expect(shouldCommitTowerDrag({ x: 100, y: 100 }, { x: 100, y: 100 }, false)).toBe(false);
    expect(shouldCommitTowerDrag({ x: 100, y: 100 }, { x: 103, y: 103 }, true, 5)).toBe(false);
  });

  it('commits only a deliberate drag released on the canvas', () => {
    expect(shouldCommitTowerDrag({ x: 100, y: 100 }, { x: 130, y: 140 }, false)).toBe(false);
    expect(shouldCommitTowerDrag({ x: 100, y: 100 }, { x: 130, y: 140 }, true)).toBe(true);
  });
});
