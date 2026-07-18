// ============================================================
// src/ui/ritual.ts — 起卦儀式 overlay DOM 與程式化視覺提供者
// ============================================================
//
// 本檔建立 DOM 結構、播放生命週與不依賴外部檔案的儀式視覺。
// 邏輯層透過 playOpeningRitual(goalId, onComplete) 觸發，內部決定：
//   1. ritualEnabled=false → 直接 onComplete(false)
//   2. enabled=true → 顯示 #ritual-overlay，呼叫 provider.play()
//      - 成功結束 → onComplete(false) + cleanup
//      - 載入/播放失敗 → 顯示 fallback 文字、等待 fallbackDurationMs → onComplete(false)
//      - 玩家按跳過/Space → onComplete(true) + cleanup
//
// 日後若有正式資產，只需以 setRitualAssetProvider() 替換提供者，
// 不需要改動本檔流程。

import type { RitualAssetProvider, RitualCallbacks, RitualSettings } from '../goals/types';

const RITUAL_OVERLAY_ID = 'ritual-overlay';
const FALLBACK_TEXT = '卦象凝結中…';
const SKIP_LABEL = '跳過';
const RITUAL_DURATION_MS = 2200;

/**
 * 預設程式化儀式：以 DOM/CSS 繪出太極、五行方位與卦爻。
 * 不需載入外部資產，因此離線、資產缺失時也能正常播放；仍可由正式
 * asset provider 取代。
 */
class WuxingRitualAssetProvider implements RitualAssetProvider {
  loadAssets(): Promise<void> {
    return Promise.resolve();
  }
  play(container: HTMLElement): void {
    const placeholder = container.querySelector('.ritual-placeholder');
    const fallbackText = container.querySelector('.ritual-fallback-text');
    placeholder?.remove();
    if (fallbackText instanceof HTMLElement) fallbackText.hidden = true;

    const ritual = document.createElement('div');
    ritual.className = 'wuxing-ritual-art';
    ritual.setAttribute('role', 'presentation');
    ritual.innerHTML = `
      <div class="ritual-seal ritual-seal-top">天</div>
      <div class="ritual-seal ritual-seal-bottom">地</div>
      <div class="ritual-orbit ritual-orbit-outer" aria-hidden="true">
        <span class="ritual-element ritual-wood">木</span>
        <span class="ritual-element ritual-fire">火</span>
        <span class="ritual-element ritual-earth">土</span>
        <span class="ritual-element ritual-metal">金</span>
        <span class="ritual-element ritual-water">水</span>
      </div>
      <div class="ritual-orbit ritual-orbit-inner" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <div class="ritual-taiji" aria-hidden="true"><span></span><i></i></div>
      <div class="ritual-invocation">五行歸元</div>
      <div class="ritual-caption">起卦・定局</div>
    `;
    container.prepend(ritual);
  }
  cleanup(): void {
    // DOM 隨 overlay 移除，不保留任何計時器或全域資源。
  }
}

/** 預設提供者；正式素材可由 setRitualAssetProvider 替換 */
let ritualProvider: RitualAssetProvider = new WuxingRitualAssetProvider();

/** 注入美術實作；Codex 後續可呼叫此 API 切換實際 provider */
export function setRitualAssetProvider(provider: RitualAssetProvider): void {
  ritualProvider = provider;
}

/** 預設設定；玩家可由 talentData.ritualEnabled 開關 */
const defaultSettings: RitualSettings = {
  enabled: true,
  skipKeyBind: 'Space',
  fallbackDurationMs: 2000,
};

/**
 * 觸發起卦儀式動畫，再呼叫 onComplete。
 * 由主選單「開始遊戲」button handler 包裝呼叫。
 *
 * @param goalId 當前下次目標 id（可 null）
 * @param ritualEnabled 玩家設定是否啟用
 * @param onComplete 動畫結束或跳過後的回呼；skipped=true 表示玩家主動跳過
 */
export function playOpeningRitual(
  goalId: string | null,
  ritualEnabled: boolean,
  onComplete: (skipped: boolean) => void,
): void {
  // 主選單切換前的安全網：不破壞既有流程
  if (typeof document === 'undefined') {
    onComplete(false);
    return;
  }

  const settings: RitualSettings = { ...defaultSettings, enabled: ritualEnabled };
  if (!settings.enabled) {
    onComplete(false);
    return;
  }

  // reduced-motion 偏好者自動跳過動畫
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onComplete(false);
    return;
  }

  const overlay = ensureRitualOverlay(settings, goalId);
  if (!overlay) {
    onComplete(false);
    return;
  }

  let finished = false;
  const finish = (skipped: boolean): void => {
    if (finished) return;
    finished = true;
    callbacksFor(overlay, goalId).onRitualEnd(skipped);
    try {
      ritualProvider.cleanup();
    } catch { /* provider 失誤不阻擋流程 */ }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', onKeyDown);
    onComplete(skipped);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === settings.skipKeyBind || e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // 跳過按鈕
  const skipBtn = overlay.querySelector('.ritual-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => finish(true));
  }

  callbacksFor(overlay, goalId).onRitualStart(goalId);

  // 載入資源 → 成功播放固定長度 / 失敗走 fallback
  ritualProvider
    .loadAssets()
    .then(() => {
      try {
        const stage = overlay.querySelector('.ritual-stage') as HTMLElement | null;
        if (stage) ritualProvider.play(stage);
      } catch (err) {
        callbacksFor(overlay, goalId).onRitualError({ phase: 'play', message: (err as Error)?.message ?? String(err) });
        runFallback(overlay, settings, finish);
        return;
      }
      window.setTimeout(() => finish(false), RITUAL_DURATION_MS);
    })
    .catch((err: unknown) => {
      callbacksFor(overlay, goalId).onRitualError({ phase: 'load', message: (err as Error)?.message ?? String(err) });
      runFallback(overlay, settings, finish);
    });
}

/** 顯示失敗時的安全回退文字並於 fallbackDurationMs 後 finish(false) */
function runFallback(
  overlay: HTMLElement,
  settings: RitualSettings,
  finish: (skipped: boolean) => void,
): void {
  const fallbackEl = overlay.querySelector('.ritual-fallback-text') as HTMLElement | null;
  if (fallbackEl) {
    fallbackEl.hidden = false;
    fallbackEl.textContent = FALLBACK_TEXT;
  }
  window.setTimeout(() => finish(false), settings.fallbackDurationMs);
}

/**
 * 建立（或取得已存在的）#ritual-overlay overlay。
 * 結構：
 *   #ritual-overlay
 *     .ritual-backdrop
 *     .ritual-stage       ← provider.play() 在此容器內繪製
 *       .ritual-placeholder     ← provider 失敗前的安全文字
 *       .ritual-fallback-text   ← 載入失敗時顯示
 *     .ritual-skip-btn    ← 跳過按鈕
 */
function ensureRitualOverlay(_settings: RitualSettings, _goalId: string | null): HTMLElement | null {
  let overlay = document.getElementById(RITUAL_OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = RITUAL_OVERLAY_ID;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.className = 'ritual-overlay';

  const backdrop = document.createElement('div');
  backdrop.className = 'ritual-backdrop';

  const stage = document.createElement('div');
  stage.className = 'ritual-stage';

  const placeholder = document.createElement('div');
  placeholder.className = 'ritual-placeholder';
  placeholder.textContent = FALLBACK_TEXT;

  const fallbackText = document.createElement('div');
  fallbackText.className = 'ritual-fallback-text';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'ritual-skip-btn';
  skipBtn.type = 'button';
  skipBtn.textContent = SKIP_LABEL;
  skipBtn.setAttribute('aria-label', '跳過起卦動畫');

  stage.append(placeholder, fallbackText);
  overlay.append(backdrop, stage, skipBtn);
  document.body.appendChild(overlay);
  return overlay;
}

/** 內部使用的 callbacks 工廠；目前只 log 到 devtools，不產生副作用 */
function callbacksFor(_overlay: HTMLElement, _goalId: string | null): RitualCallbacks {
  return {
    onRitualStart: () => { /* noop；美術層可注入後續音效 */ },
    onRitualEnd: () => { /* noop */ },
    onRitualError: () => { /* noop；流程已由 runFallback 兜底 */ },
  };
}
