// ============================================================
// src/audio/audioSystem.ts — 遊戲音效與背景音樂系統
// ============================================================

const BGM_PLAYLIST = [
  'assets/audio/Rain_on_the_Pagoda_Roof.mp3',
  'assets/audio/Tiles_in_Motion.mp3',
  'assets/audio/Iron_River_Gate.mp3'
];

let currentBgmIndex = 0;
let bgmAudio: HTMLAudioElement | null = null;
let bgmTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isMusicEnabled = true;
let hasUserInteracted = false;
let bgmErrorCount = 0;

const sfxAssets: Record<string, HTMLAudioElement[]> = {};
const MAX_POOL_SIZE = 10;
const sfxPaths = {
  click: 'assets/audio/click.mp3',
  shoot: 'assets/audio/shoot.mp3',
  enemy_death: 'assets/audio/enemy_death.mp3',
  merge_success: 'assets/audio/merge_success.mp3',
  hit: 'assets/audio/hit.mp3',
  crit: 'assets/audio/crit.mp3',
  hit_fire: 'assets/audio/hit_fire.mp3',
  hit_water: 'assets/audio/hit_water.mp3',
  hit_wood: 'assets/audio/hit_wood.mp3',
  hit_metal: 'assets/audio/hit_metal.mp3',
  hit_earth: 'assets/audio/hit_earth.mp3',
  hit_yin: 'assets/audio/hit_yin.mp3',
  hit_yang: 'assets/audio/hit_yang.mp3'
};

export type SFXType = keyof typeof sfxPaths;

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playSynthSFX(type: SFXType) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'shoot') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.linearRampToValueAtTime(1000, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'crit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'enemy_death') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'merge_success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(261.63, now); // C4
      osc.frequency.setValueAtTime(329.63, now + 0.07); // E4
      osc.frequency.setValueAtTime(392.00, now + 0.14); // G4
      osc.frequency.setValueAtTime(523.25, now + 0.21); // C5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.21);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'hit_fire') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'hit_water') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1500, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'hit_wood') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'hit_metal') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'hit_earth') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'hit_yin' || type === 'hit_yang') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    // 默默捕獲錯誤，防止資源不存在或瀏覽器安全策略導致中斷
  }
}

export function initSFX() {
  for (const [key, path] of Object.entries(sfxPaths)) {
    sfxAssets[key] = [];
    for (let i = 0; i < 2; i++) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      sfxAssets[key].push(audio);
    }
  }
}

export function playSFX(type: SFXType) {
  if (!isMusicEnabled) return;

  const pool = sfxAssets[type];
  if (!pool) {
    playSynthSFX(type);
    return;
  }

  let audioToPlay = pool.find(audio => audio.paused || audio.ended);

  if (!audioToPlay && pool.length < MAX_POOL_SIZE) {
    audioToPlay = new Audio(sfxPaths[type]);
    audioToPlay.preload = 'auto';
    pool.push(audioToPlay);
  }

  if (!audioToPlay) {
    audioToPlay = pool[0];
    audioToPlay.pause();
  }

  audioToPlay.volume = type === 'shoot' || type.startsWith('hit') ? 0.2 : 0.45;
  audioToPlay.currentTime = 0;
  audioToPlay.play().catch(() => {
    playSynthSFX(type);
  });
}

export function playNextBGM() {
  if (!isMusicEnabled) return;
  stopBGM();

  const track = BGM_PLAYLIST[currentBgmIndex];
  bgmAudio = new Audio(track);
  bgmAudio.volume = 0.35;

  bgmAudio.addEventListener('error', () => {
    console.warn(`[BGM] 載入音樂失敗: ${track}。嘗試播放下一首。`);
    stopBGM();
    bgmErrorCount++;
    if (bgmErrorCount >= BGM_PLAYLIST.length) {
      console.error('[BGM] 所有背景音樂皆無法加載，停止背景音樂播放系統。');
      return;
    }
    currentBgmIndex = (currentBgmIndex + 1) % BGM_PLAYLIST.length;
    playNextBGM();
  });

  bgmAudio.addEventListener('canplaythrough', () => {
    bgmErrorCount = 0;
  }, { once: true });

  bgmAudio.addEventListener('ended', () => {
    currentBgmIndex = (currentBgmIndex + 1) % BGM_PLAYLIST.length;
    bgmTimeoutId = setTimeout(() => {
      playNextBGM();
    }, 5000);
  });

  bgmAudio.play().catch((err) => {
    console.warn('[BGM] 自動播放被瀏覽器阻擋，等待玩家點擊解鎖：', err);
  });
}

export function stopBGM() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio = null;
  }
  if (bgmTimeoutId) {
    clearTimeout(bgmTimeoutId);
    bgmTimeoutId = null;
  }
}

export function initBgmUnlocker() {
  const unlock = () => {
    if (hasUserInteracted) return;
    hasUserInteracted = true;
    initSFX();
    playNextBGM();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock);
  window.addEventListener('touchstart', unlock);
}

export function setupMusicToggle() {
  const btnToggleMusic = document.getElementById('btnToggleMusic');
  if (!btnToggleMusic) return;

  btnToggleMusic.addEventListener('click', (e) => {
    e.stopPropagation();
    isMusicEnabled = !isMusicEnabled;
    if (isMusicEnabled) {
      btnToggleMusic.textContent = '🎵';
      (btnToggleMusic as HTMLElement).style.borderColor = '#6366f1';
      if (hasUserInteracted) {
        playNextBGM();
      }
    } else {
      btnToggleMusic.textContent = '🔇';
      (btnToggleMusic as HTMLElement).style.borderColor = '#ef4444';
      stopBGM();
    }
  });
}
