import { describe, expect, it } from 'vitest';
import { TALENT_TREE, type TalentSaveData } from '../talent';
import {
  TALENT_CONNECTIONS,
  TALENT_OUTER_SEALS,
  buildTalentConnectionCurve,
  getTalentConnectionState,
} from '../ui/talentConnections';

function saveData(overrides: Partial<TalentSaveData> = {}): TalentSaveData {
  return {
    totalTalentPoints: 0,
    spentTalentPoints: 0,
    talentLevels: {},
    ...overrides,
  };
}

describe('P2-D talent connections', () => {
  it('derives every real connection from TALENT_TREE prerequisites', () => {
    const expected = TALENT_TREE.flatMap(node =>
      node.prerequisites.map(from => `${from}->${node.id}`),
    ).sort();
    const actual = TALENT_CONNECTIONS
      .filter(connection => connection.kind !== 'outer')
      .map(connection => `${connection.from}->${connection.to}`)
      .sort();

    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(7);
  });

  it('keeps all five outer seals decorative and permanently locked', () => {
    const data = saveData({
      totalTalentPoints: 99,
      talentLevels: {
        wood_awakening: 5,
        fire_awakening: 5,
        earth_awakening: 5,
        metal_awakening: 5,
        water_awakening: 5,
      },
    });
    const outerConnections = TALENT_CONNECTIONS.filter(connection => connection.kind === 'outer');

    expect(TALENT_OUTER_SEALS).toHaveLength(5);
    expect(outerConnections).toHaveLength(5);
    outerConnections.forEach(connection => {
      expect(getTalentConnectionState(data, connection)).toBe('locked');
    });
  });

  it('distinguishes locked, available, active, and maxed route states', () => {
    const connection = TALENT_CONNECTIONS.find(item => item.to === 'fortress_2');
    expect(connection).toBeDefined();
    if (!connection) return;

    expect(getTalentConnectionState(saveData({
      totalTalentPoints: 2,
      spentTalentPoints: 2,
      talentLevels: { fortress_1: 1 },
    }), connection)).toBe('locked');
    expect(getTalentConnectionState(saveData({
      totalTalentPoints: 10,
      spentTalentPoints: 2,
      talentLevels: { fortress_1: 1 },
    }), connection)).toBe('available');
    expect(getTalentConnectionState(saveData({
      talentLevels: { fortress_1: 1, fortress_2: 1 },
    }), connection)).toBe('active');
    expect(getTalentConnectionState(saveData({
      talentLevels: { fortress_1: 1, fortress_2: 5 },
    }), connection)).toBe('maxed');
  });

  it('requires both yin and yang before both Taiji convergence routes become available', () => {
    const convergences = TALENT_CONNECTIONS.filter(connection => connection.kind === 'convergence');
    expect(convergences).toHaveLength(2);

    const oneSide = saveData({
      totalTalentPoints: 20,
      spentTalentPoints: 3,
      talentLevels: { yin_law: 1 },
    });
    convergences.forEach(connection => {
      expect(getTalentConnectionState(oneSide, connection)).toBe('locked');
    });

    const bothSides = saveData({
      totalTalentPoints: 20,
      spentTalentPoints: 6,
      talentLevels: { yin_law: 1, yang_law: 1 },
    });
    convergences.forEach(connection => {
      expect(getTalentConnectionState(bothSides, connection)).toBe('available');
    });
  });

  it('builds finite curves for horizontal, vertical, and coincident points', () => {
    const paths = [
      buildTalentConnectionCurve({ x: 0, y: 0 }, { x: 100, y: 0 }),
      buildTalentConnectionCurve({ x: 0, y: 0 }, { x: 0, y: 100 }),
      buildTalentConnectionCurve({ x: 25, y: 25 }, { x: 25, y: 25 }),
    ];

    paths.forEach(path => {
      expect(path).not.toContain('NaN');
      expect(path).not.toContain('Infinity');
    });
    expect(paths[0]).toContain(' C ');
    expect(paths[1]).toContain(' C ');
    expect(paths[2]).toBe('M 25 25 L 25 25');
  });
});
