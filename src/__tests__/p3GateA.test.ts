import { describe, expect, it } from 'vitest';
import {
  P3_GATE_A_CONFIG,
  applyElementResistance,
  getElementResistanceRate,
  getGateARefund,
  getLowHpCompensation,
  isFullRefundAvailable,
} from '../battle/p3GateA';

describe('P3 Gate A balance rules', () => {
  it('keeps resistance tiers ordered and bounded', () => {
    const { tiers, maxReduction } = P3_GATE_A_CONFIG.elementResistance;
    expect(tiers.map(tier => tier.minWave)).toEqual([6, 11, 16]);
    expect(tiers.every(tier => tier.reduction > 0 && tier.reduction <= maxReduction)).toBe(true);
  });

  it('ramps non-counter resistance from wave 6 without affecting earlier waves', () => {
    expect(getElementResistanceRate(5, false)).toBe(0);
    expect(getElementResistanceRate(6, false)).toBe(0.1);
    expect(getElementResistanceRate(10, false)).toBe(0.1);
    expect(getElementResistanceRate(11, false)).toBe(0.15);
    expect(getElementResistanceRate(16, false)).toBe(0.2);
    expect(getElementResistanceRate(30, false)).toBe(0.2);
  });

  it('lets counters and true damage bypass resistance', () => {
    expect(applyElementResistance(100, 16, true)).toBe(100);
    expect(applyElementResistance(100, 16, false, true)).toBe(100);
    expect(applyElementResistance(100, 16, false)).toBe(80);
    expect(applyElementResistance(1, 16, false)).toBe(1);
  });

  it('grants full refunds only through wave 4 outside the test level', () => {
    expect(isFullRefundAvailable(4, false)).toBe(true);
    expect(isFullRefundAvailable(5, false)).toBe(false);
    expect(getGateARefund(4, 18, 12, false)).toBe(18);
    expect(getGateARefund(3, 30, 12, false)).toBe(30);
    expect(getGateARefund(3, 0, 12, false)).toBe(0);
    expect(getGateARefund(5, 18, 12, false)).toBe(12);
    expect(getGateARefund(3, 18, 12, true)).toBe(12);
  });

  it('grants one low-HP recovery equal to a standard basic tower', () => {
    expect(getLowHpCompensation(7, 20, 0, false)).toBe(12);
    expect(getLowHpCompensation(8, 20, 0, false)).toBe(0);
    expect(getLowHpCompensation(7, 20, 1, false)).toBe(0);
    expect(getLowHpCompensation(7, 20, 0, true)).toBe(0);
  });
});
