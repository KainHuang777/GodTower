// src/system/platform.ts — 平台與持久化存檔抽象層

export interface IPlatform {
  getPlatformName(): string;
  exitApp(): void;
  openUrl(url: string): void;
}

export interface IPayment {
  isStoreEnabled(): boolean;
  purchaseProduct(productId: string): Promise<boolean>;
}

export interface ISaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ============================================================
// Web 平台預設實作
// ============================================================

export class WebPlatform implements IPlatform {
  getPlatformName(): string {
    return 'web';
  }
  exitApp(): void {
    window.close();
  }
  openUrl(url: string): void {
    window.open(url, '_blank');
  }
}

export class WebPayment implements IPayment {
  isStoreEnabled(): boolean {
    return false; // Web 端預設不啟用內購/商店
  }
  async purchaseProduct(productId: string): Promise<boolean> {
    console.log(`[WebPayment] purchaseProduct called for ${productId} - not supported on web.`);
    return false;
  }
}

export class LocalSaveStorage implements ISaveStorage {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}

// 匯出當前平台的預設實作單例，便於其他模組直接引入與替換
export const currentPlatform: IPlatform = new WebPlatform();
export const currentPayment: IPayment = new WebPayment();
export const currentSaveStorage: ISaveStorage = new LocalSaveStorage();
