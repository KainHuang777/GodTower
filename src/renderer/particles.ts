// ============================================================
// src/renderer/particles.ts — 粒子特效系統
// ============================================================

import type { Particle } from '../types';

export function createSplatterParticles(particles: Particle[], tileSize: number, x: number, y: number, color: string, count: number = 4) {
  const pScale = tileSize / 16;
  for (let i = 0; i < count; i++) {
    const vx = (Math.random() - 0.5) * 3 * pScale;
    const vy = (-1.5 - Math.random() * 2.5) * pScale;
    particles.push({
      x, y,
      vx, vy,
      color,
      alpha: 1.0,
      size: (1.5 + Math.random() * 2) * pScale,
      life: 0,
      maxLife: 20 + Math.floor(Math.random() * 15),
      gravity: 0.18 * pScale,
      isPixel: true,
      dragMultiplier: 0.98
    });
  }
}

export function createHitParticles(particles: Particle[], tileSize: number, x: number, y: number, color: string) {
  const pScale = tileSize / 16;
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 3) * pScale;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: (2 + Math.random() * 3) * pScale,
      life: 0,
      maxLife: 20 + Math.floor(Math.random() * 15)
    });
  }
}

export function createDeathParticles(particles: Particle[], tileSize: number, x: number, y: number, color: string) {
  const pScale = tileSize / 16;
  const count = 15 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1.5 + Math.random() * 4) * pScale;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: (3 + Math.random() * 4) * pScale,
      life: 0,
      maxLife: 30 + Math.floor(Math.random() * 20)
    });
  }
  particles.push({
    x, y,
    vx: 0, vy: 0,
    color,
    alpha: 1.0,
    size: 4 * pScale,
    life: 0,
    maxLife: 35,
    isRing: true,
    maxRadius: 60 * pScale
  });
}

export function createMergeParticles(particles: Particle[], tileSize: number, x: number, y: number) {
  const pScale = tileSize / 16;
  const count = 36;
  const radius = 8 * pScale;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.8 * pScale;
    particles.push({
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#c084fc',
      alpha: 1.0,
      size: 3 * pScale,
      life: 0,
      maxLife: 40
    });
  }
}

export function updateParticles(particles: Particle[]) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life++;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }

    if (p.isRing) {
      p.size += (p.maxRadius! - p.size) * 0.15;
    } else {
      if (p.gravity !== undefined) {
        p.vy += p.gravity;
      }
      p.x += p.vx;
      p.y += p.vy;
      const drag = p.dragMultiplier !== undefined ? p.dragMultiplier : 0.95;
      p.vx *= drag;
      p.vy *= drag;
    }

    p.alpha = 1.0 - p.life / p.maxLife;
  }
}
