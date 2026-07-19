// src/ui/achievementNotify.ts — 成就解鎖通知的 DOM overlay 與顯示佇列

import { playSFX } from '../audio/audioSystem';
import { getAchievementById } from '../collection/config';
import type { AchievementDefinition } from '../collection/types';

const DISPLAY_MS = 3000;
const EXIT_MS = 240;

let pendingIds: string[] = [];
let queuedIds = new Set<string>();
let activeId: string | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export function showAchievementUnlockNotification(achievementIds: string[]): void {
  if (typeof document === 'undefined') return;

  for (const id of achievementIds) {
    if (!getAchievementById(id) || id === activeId || queuedIds.has(id)) continue;
    pendingIds.push(id);
    queuedIds.add(id);
  }

  if (!activeId) showNextAchievement();
}

function showNextAchievement(): void {
  const id = pendingIds.shift();
  if (!id) return;

  const achievement = getAchievementById(id);
  if (!achievement) {
    queuedIds.delete(id);
    showNextAchievement();
    return;
  }

  activeId = id;
  const host = getNotificationHost();
  const card = createNotificationCard(
    achievement.label,
    achievement.description,
    achievement.tier,
  );
  host.replaceChildren(card);

  try {
    playSFX('merge_success');
  } catch {
    // 音效失敗時維持靜默，通知本身仍要可見。
  }

  const dismiss = () => dismissActiveAchievement(card);
  card.addEventListener('click', dismiss, { once: true });
  dismissTimer = setTimeout(dismiss, DISPLAY_MS);
}

function dismissActiveAchievement(card: HTMLButtonElement): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  const finish = () => {
    card.remove();
    if (activeId) queuedIds.delete(activeId);
    activeId = null;
    showNextAchievement();
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }

  card.classList.add('achievement-notification-leaving');
  setTimeout(finish, EXIT_MS);
}

function getNotificationHost(): HTMLDivElement {
  let host = document.getElementById('achievementNotificationHost') as HTMLDivElement | null;
  if (host) return host;

  host = document.createElement('div');
  host.id = 'achievementNotificationHost';
  host.className = 'achievement-notification-host';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'true');
  document.body.append(host);
  return host;
}

function createNotificationCard(
  label: string,
  description: string,
  tier: AchievementDefinition['tier'],
): HTMLButtonElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `achievement-notification achievement-notification-${tier}`;
  card.setAttribute('aria-label', `成就解鎖：${label}。${description}。點擊收起通知。`);

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'achievement-notification-icon');
  icon.setAttribute('viewBox', '0 0 32 32');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<path d="M8 4h16v7c0 5-3 8-8 8s-8-3-8-8zM10 27h12M16 19v8M8 7H4v2c0 4 2 6 5 6m15-8h4v2c0 4-2 6-5 6"/>';

  const copy = document.createElement('span');
  copy.className = 'achievement-notification-copy';
  const title = document.createElement('strong');
  title.textContent = '成就解鎖！';
  const name = document.createElement('span');
  name.className = 'achievement-notification-name';
  name.textContent = label;
  const desc = document.createElement('span');
  desc.className = 'achievement-notification-description';
  desc.textContent = description;
  const dismiss = document.createElement('span');
  dismiss.className = 'achievement-notification-dismiss';
  dismiss.textContent = '點擊收起';

  copy.append(title, name, desc, dismiss);
  card.append(icon, copy);
  return card;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
