import { describe, expect, it } from 'vitest';
import {
  buildRouteMasks,
  ROUTE_EAST,
  ROUTE_NORTH,
  ROUTE_SOUTH,
  ROUTE_WEST,
} from '../renderer/tileAutotile';
import { resolveAtlasRoadTileVariant, resolveRoadAutotileCell } from '../renderer/terrainAssets';

describe('route autotile masks', () => {
  it('builds horizontal endpoints and a straight center', () => {
    const masks = buildRouteMasks([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(masks.get('0,0')).toBe(ROUTE_EAST);
    expect(masks.get('1,0')).toBe(ROUTE_EAST | ROUTE_WEST);
    expect(masks.get('2,0')).toBe(ROUTE_WEST);
  });

  it('builds a corner from ordered route steps', () => {
    const masks = buildRouteMasks([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(masks.get('1,1')).toBe(ROUTE_NORTH | ROUTE_EAST);
  });

  it('merges repeated passes into a four-way crossing', () => {
    const masks = buildRouteMasks([
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
      { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
    ]);
    expect(masks.get('1,1')).toBe(ROUTE_NORTH | ROUTE_EAST | ROUTE_SOUTH | ROUTE_WEST);
  });

  it('does not connect nearby cells unless they are consecutive route steps', () => {
    const masks = buildRouteMasks([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]);
    expect(masks.get('1,0')).toBe(0);
  });

  it('uses both native atlas corners before any 90-degree rotation', () => {
    expect(resolveAtlasRoadTileVariant(ROUTE_EAST | ROUTE_SOUTH)).toEqual({ cell: 6, rotation: 0 });
    expect(resolveAtlasRoadTileVariant(ROUTE_SOUTH | ROUTE_WEST)).toEqual({ cell: 7, rotation: 0 });
    expect(resolveAtlasRoadTileVariant(ROUTE_NORTH | ROUTE_WEST)).toEqual({ cell: 6, rotation: 2 });
    expect(resolveAtlasRoadTileVariant(ROUTE_NORTH | ROUTE_EAST)).toEqual({ cell: 7, rotation: 2 });
  });

  it('maps every standard road mask to one dedicated centered autotile', () => {
    expect(resolveRoadAutotileCell(ROUTE_NORTH)).toBe(1);
    expect(resolveRoadAutotileCell(ROUTE_EAST | ROUTE_WEST)).toBe(5);
    expect(resolveRoadAutotileCell(ROUTE_EAST | ROUTE_SOUTH)).toBe(7);
    expect(resolveRoadAutotileCell(ROUTE_NORTH | ROUTE_EAST | ROUTE_SOUTH)).toBe(14);
    expect(resolveRoadAutotileCell(ROUTE_NORTH | ROUTE_EAST | ROUTE_SOUTH | ROUTE_WEST)).toBe(15);
  });
});
