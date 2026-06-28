import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 使用相對路徑，確保在 GitHub Pages 等子路徑環境下資源能正確載入
});
