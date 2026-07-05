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
const sfxPaths: Record<string, string> = {
  click: 'assets/audio/click.mp3',
  shoot: 'assets/audio/shoot.mp3',
  enemy_death: 'assets/audio/enemy_death.mp3',
  merge_success: 'assets/audio/merge_success.mp3'
};

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

export function playSFX(type: 'click' | 'shoot' | 'enemy_death' | 'merge_success') {
  if (!isMusicEnabled) return;

  const pool = sfxAssets[type];
  if (!pool) return;

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

  audioToPlay.volume = type === 'shoot' ? 0.2 : 0.45;
  audioToPlay.currentTime = 0;
  audioToPlay.play().catch(() => {
    // 默默捕獲錯誤，防止資源不存在或瀏覽器安全策略導致中斷
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
