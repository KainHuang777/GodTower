import { gameState } from '../state';
import { getAllBestiaryEntries, getAllAchievements } from '../collection/config';
import { getBestiaryUnlockedCount, getAchievementProgress } from '../collection/state';
import { getAchievementIcon, getCollectionIcon } from './collectionIcons';

export function renderCollectionTab(): void {
  const panel = document.getElementById('tab-collection');
  if (!panel) return;

  const talentData = gameState.talentData;
  const cprog = talentData.collectionProgress ?? { totalKills: 0, totalMerges: 0, totalVictories: 0, highestWave: 0 };
  const completed = talentData.collectionCompleted ?? [];

  let html = '<div class="collection-tab-layout">';

  // --- Bestiary section ---
  html += '<div class="collection-section"><h3 class="collection-section-title">萬獸圖鑑</h3><div class="collection-grid bestiary-grid">';
  const allBestiary = getAllBestiaryEntries();
  allBestiary.forEach(entry => {
    let unlocked = false;
    if (entry.category === 'trait') {
      const traitKey = entry.id.replace(/^trait_/, '');
      unlocked = talentData.collectionBestiary?.traits?.[traitKey] === true;
    } else {
      unlocked = talentData.collectionBestiary?.enemies?.[entry.id] === true ||
        talentData.collectionBestiary?.towers?.[entry.id] === true;
    }
    const cat = entry.category === 'enemy' ? '妖' : entry.category === 'trait' ? '魄' : '器';
    if (unlocked) {
      html += `<div class="collection-card unlocked" data-id="${entry.id}">`;
      html += `<span class="collection-icon-frame">${getCollectionIcon(entry.id)}</span>`;
      html += `<div class="collection-card-body">`;
      html += `<span class="collection-name">${entry.label}</span>`;
      html += `<span class="collection-meta">${cat}・${entry.element || '無'}</span>`;
      if (entry.lore) html += `<p class="collection-desc">${entry.lore}</p>`;
      html += `</div></div>`;
    } else {
      html += `<div class="collection-card locked" data-id="${entry.id}">`;
      html += `<span class="collection-icon-frame collection-icon-locked">${getCollectionIcon('unknown')}</span>`;
      html += `<div class="collection-card-body">`;
      html += `<span class="collection-name unknown">？？？</span>`;
      html += `<span class="collection-meta">${cat}・未解鎖</span>`;
      html += `</div></div>`;
    }
  });
  html += '</div></div>';

  // --- Achievements section ---
  html += '<div class="collection-section"><h3 class="collection-section-title">成就</h3><div class="collection-grid achievement-grid">';
  const allAchievements = getAllAchievements();
  allAchievements.forEach(ach => {
    const done = completed.includes(ach.id);
    if (done) {
      html += `<div class="collection-card achievement-card done" data-id="${ach.id}">`;
      html += `<span class="collection-icon-frame">${getAchievementIcon(true)}</span>`;
      html += `<div class="collection-card-body">`;
      html += `<span class="collection-name">${ach.label}</span>`;
      html += `<span class="collection-meta completion">已完成</span>`;
      html += `</div></div>`;
    } else {
      const cond = ach.condition;
      let progressStr = '';
      if (cond?.key === 'totalKills') progressStr = `擊殺 ${cprog.totalKills}/${cond.value}`;
      else if (cond?.key === 'totalMerges') progressStr = `合成 ${cprog.totalMerges}/${cond.value}`;
      else if (cond?.key === 'highestWave') progressStr = `最高波次 ${cprog.highestWave}/${cond.value}`;
      else if (cond?.key === 'totalVictories') progressStr = `勝利 ${cprog.totalVictories}/${cond.value}`;
      html += `<div class="collection-card achievement-card pending" data-id="${ach.id}">`;
      html += `<span class="collection-icon-frame">${getAchievementIcon(false)}</span>`;
      html += `<div class="collection-card-body">`;
      html += `<span class="collection-name">${ach.label}</span>`;
      html += `<span class="collection-meta progress">${progressStr}</span>`;
      if (ach.description) html += `<p class="collection-desc">${ach.description}</p>`;
      html += `</div></div>`;
    }
  });
  html += '</div></div>';

  // --- Stats summary ---
  const bestiaryCount = getBestiaryUnlockedCount(gameState.talentData);
  const totalBestiary = allBestiary.length;
  const achieveInfo = getAchievementProgress(gameState.talentData);
  const achievePct = achieveInfo.total > 0 ? Math.round(achieveInfo.completed / achieveInfo.total * 100) : 0;
  const bestiaryPct = totalBestiary > 0 ? Math.round(bestiaryCount.total / totalBestiary * 100) : 0;
  const tierClass = getHighestAchievementTier(allAchievements, completed);
  html += '<div class="collection-stats">';
  html += `<div class="collection-progress-row"><span class="collection-progress-label">圖鑑進度</span><div class="collection-progress-track bestiary-progress" role="progressbar" aria-label="圖鑑進度" aria-valuemin="0" aria-valuemax="${totalBestiary}" aria-valuenow="${bestiaryCount.total}"><span style="width:${bestiaryPct}%"></span></div><span class="collection-progress-value">${bestiaryCount.total}/${totalBestiary}・${bestiaryPct}%</span></div>`;
  html += `<div class="collection-progress-row"><span class="collection-progress-label">成就進度</span><div class="collection-progress-track achievement-progress ${tierClass}" role="progressbar" aria-label="成就進度" aria-valuemin="0" aria-valuemax="${allAchievements.length}" aria-valuenow="${completed.length}"><span style="width:${achievePct}%"></span></div><span class="collection-progress-value">${completed.length}/${allAchievements.length}・${achievePct}%</span></div>`;
  html += `<div class="collection-stat-summary"><span>總擊殺 ${cprog.totalKills}</span><span>最高波次 ${cprog.highestWave}</span></div>`;
  html += '</div>';

  html += '</div>';
  panel.innerHTML = html;
}

function getHighestAchievementTier(
  achievements: ReturnType<typeof getAllAchievements>,
  completed: string[],
): 'bronze' | 'silver' | 'gold' {
  const tiers = { bronze: 1, silver: 2, gold: 3 } as const;
  let highest: keyof typeof tiers = 'bronze';
  for (const achievement of achievements) {
    if (completed.includes(achievement.id) && tiers[achievement.tier] > tiers[highest]) {
      highest = achievement.tier;
    }
  }
  return highest;
}
