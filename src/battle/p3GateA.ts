import gateAConfig from '../config/p3GateA.json';

interface ResistanceTier {
  minWave: number;
  reduction: number;
}

interface GateAConfig {
  elementResistance: {
    startWave: number;
    maxReduction: number;
    tiers: ResistanceTier[];
  };
  antiSnowball: {
    fullRefundMaxWave: number;
    fullRefundRate: number;
    lowHpCompensation: {
      hpThresholdRatio: number;
      goldAmount: number;
      maxTriggers: number;
    };
  };
}

export const P3_GATE_A_CONFIG = gateAConfig as GateAConfig;

export function getElementResistanceRate(
  wave: number,
  isCounter: boolean,
  isTrueDamage = false,
): number {
  if (isCounter || isTrueDamage || wave < P3_GATE_A_CONFIG.elementResistance.startWave) return 0;

  let reduction = 0;
  for (const tier of P3_GATE_A_CONFIG.elementResistance.tiers) {
    if (wave >= tier.minWave) reduction = tier.reduction;
  }

  return Math.min(P3_GATE_A_CONFIG.elementResistance.maxReduction, Math.max(0, reduction));
}

export function applyElementResistance(
  damage: number,
  wave: number,
  isCounter: boolean,
  isTrueDamage = false,
): number {
  if (damage <= 0) return 0;
  const reduction = getElementResistanceRate(wave, isCounter, isTrueDamage);
  return Math.max(1, Math.floor(damage * (1 - reduction)));
}

export function isFullRefundAvailable(wave: number, isTestLevel: boolean): boolean {
  return !isTestLevel && wave <= P3_GATE_A_CONFIG.antiSnowball.fullRefundMaxWave;
}

export function getGateARefund(
  wave: number,
  paidCost: number,
  normalRefund: number,
  isTestLevel: boolean,
): number {
  if (!isFullRefundAvailable(wave, isTestLevel)) return normalRefund;
  return Math.floor(paidCost * P3_GATE_A_CONFIG.antiSnowball.fullRefundRate);
}

export function getLowHpCompensation(
  currentHp: number,
  maxHp: number,
  triggerCount: number,
  isTestLevel: boolean,
): number {
  const config = P3_GATE_A_CONFIG.antiSnowball.lowHpCompensation;
  if (isTestLevel || maxHp <= 0 || triggerCount >= config.maxTriggers) return 0;
  if (currentHp / maxHp > config.hpThresholdRatio) return 0;
  return config.goldAmount;
}
