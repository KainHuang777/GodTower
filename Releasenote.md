# 遊戲更新日誌 (Release Notes)

## V0.50
### 2026-07-12
本次 **v0.5.0 版本** 迎來了遊戲上線以來最重大的「數值平衡與玩法機制耦合」調整！我們針對原版後期金幣過剩、怪物難度崩潰以及天賦系統與戰局缺乏聯動的問題，進行了系統性重構。以下為本次改版的詳細內容：

#### ⚖️ 天賦、經濟與難度深度耦合（B3 盲點修正）
1. **🧬 天賦感知難度補償系統 (Monster HP Mod)**：怪物生命值將與玩家已花費的**天賦點比例**掛鉤。當玩家天賦點滿（花費 85 點）時，怪物將獲得 **+50%** 的額外 HP 補償，確保資深玩家在無 Ascension 難度下依然能感受到充足的戰鬥威脅。
2. **🪙 開局資金軟上限 (200g Soft Cap)**：天賦 `初始資金 I` 與 `初始資金 II` 提供的開局金幣上限調整為 **200g**（原最高可達 310g），保留早期防線建設的資源決策張力。
3. **📉 波次防禦獎勵金動態衰減**：調整防守成功時獲取的波次獎勵金，加入動態衰減公式 `max(10, 15 + wave * 3 - floor(wave / 3) * 4)`。後期波次獎勵金將逐步遞減，Wave 20 獎勵金由 **75g 降低至 51g (-32%)**，抑制後期資金溢出的問題。
4. **🧭 天賦與難度挑戰耦合提示**：當偵測到玩家天賦花費達 **20/40/60 點** 以上時，會於主選單與難度選擇介面跳出對應的 Ascension 難度挑戰建議（如：建議挑戰 Ascension 1-2 / 3+ / 5+）。

#### ⚔️ 詞條機制學習系統與戰鬥深化
1. **🛡️ 詞條學習與 9 張對策卡牌 (Trait Counter)**：於 Wave 3, 6, 10 遭遇特殊的護甲/再生/分裂偵查怪後，解鎖相應的對策卡牌入池（每詞條 3 種稀有度，共 9 張），包括 `破甲一擊`、`五行破甲`、`無視護甲`、`灼燒標記`、`毒纏`、`封印再生`、`速攻指令`、`制止分裂`、`反向分裂`。
2. **🌀 元素抗性衰減與反雪球機制**：Wave 6+ 的非克制屬性攻擊，傷害將衰減 10% 至 20%，更加考驗五行克制與擺放站位。新增反雪球機制——Wave 1-4 售塔 100% 退費；若玩家基地 HP < 50%，每波結束獲得額外 +5g 低血量補償。

#### 🏔️ Ascension 天譴難度挑戰系統
- 通關 Wave 20 後正式解鎖 Ascension 0-10 層難度，提供怪物 HP、速度、數量修正。高層級解鎖飛行怪提前、Boss 技能與金幣縮水等特殊規則，大幅延長遊戲壽命。

#### 🐛 核心 Bug 修復與操作打磨
- **🛠️ 合成衝突修復**：修正了在合成模式中點擊神秘召喚或卡牌隨機獲得砲台後，因為合成狀態未重置，導致點擊地面無法放置砲台且提示「沒有砲台」的漏洞。現在切換為建塔工具時，會自動且安全地關閉合成模式。
- **🎯 游標精度優化**：修復了因 CSS 縮放導致大螢幕/手機端點擊網格對齊偏移的問題。

---

## V0.40
### 2026-06-28 (60th Update)
- Resolved GitHub Actions push configuration.
  1. Release script: Included the newly created .github/workflows/deploy.yml in scripts/release.cjs git add parameters, ensuring the workflow config is properly committed and pushed.
### 2026-06-28 (59th Update)
- Resolved GitHub Pages MIME type (video/mp2t) loading error.
  1. CI/CD automation: Added GitHub Actions workflow (.github/workflows/deploy.yml) to automatically compile TS code and deploy the build target ('dist') to GitHub Pages on every push to main branch.
  2. Setup documentation: Guided user to change GitHub Pages source settings to use 'GitHub Actions'.
### 2026-06-28 (58th Update)
- Resolved GitHub Pages deployment issues where main menu buttons were unresponsive.
  1. Vite configuration: Created vite.config.ts and set base to './' to force Vite to compile assets with relative paths instead of absolute paths (which caused 404 resource errors on subpath deployments like GitHub Pages).
  2. Entry script: Changed script injection in index.html from absolute path /src/main.ts to relative path ./src/main.ts.
  3. Release process: Updated scripts/release.cjs to include vite.config.ts in Git commit index.
### 2026-06-28 (57th Update)
- Resolved Git repository safety and tracking issues by removing untracked dependencies and improving ignore rules.
  1. Untracked node_modules: Removed accidentally tracked `node_modules` from Git index via `git rm -r --cached` while preserving the local files.
  2. Untracked test images: Removed Stable Diffusion test output images `test_sd_monster.png` and `test_sd_monster_transparent.png` from Git index.
  3. Optimized .gitignore: Added ignore patterns for Python runtime caches (`__pycache__`, `.py[cod]`, `*$py.class`), virtual environments (`.venv`, `venv`, `env`), and custom SD test images (`test_sd_monster*.png`).
### 2026-06-28 (56th Update)
- Established versioning system starting at V0.1.0 (currently aligned to V0.155 / 55th Update).
  1. UI implementation: Added gameVersion div under the mainMenu subtitle in index.html, populated dynamically via GAME_VERSION in main.ts.
  2. Rule enforcement: Sub-version increments on each subsequent update. V [major].[minor] will only increment if a /release command is explicitly given.
  3. Synced package.json version to 0.1.55.
### 2026-06-28 (55th Update)
- Implemented Dead Cells style modern pixel mix visual upgrades in the main game.
  1. Default zoom: Auto-zooms mapScale to 2.0 and centers vertical offset to -320 when starting BATTLE on 80x40 large maps, rendering 16px sprites at 32px size for clarity.
  2. Scroll zoom: Registered desktop mouse wheel event listener on canvas to pan/scale around cursor.
  3. Element trail bullets: Remade bullets into glowing element cores with multi-stage alpha fading trails tracing target direction.
  4. Base shadows: Added translucent base shadow ellipses underneath pixel enemies to remove float feeling.
  5. Sprite glowing outlines: Applied element-specific shadowBlur glows on pixel towers/enemies and a bright red glow on hit-flashing.
  6. Death shockwaves: Spawn expanding colored shockwave rings on monster deaths.
### 2026-06-28 (54th Update)
- Created showcase.html: Standalone visual quality showcase page to validate the visual ceiling of existing 16×16 pixel sprite matrices.
  1. Renders all sprites at 4× scale (sprites.ts-compatible drawPixelSprite logic ported to vanilla JS).
  2. Tower display: Three Lv1 towers (Fire/Water/Yang) with shadowBlur glow, breathing squash/stretch animation, orbiting element particles; one Lv2 Fire tower (16×24 isometric sprite) with level star indicator.
  3. Enemy display: Snake (2-frame walk) and Dragon Boss (2-frame wing flap) with sway animation; automatic hit-flash (white fill + red shadowBlur) + squash + element particle burst every 2.2s.
  4. Bullet effects: 5 element-typed bullets (fire/water/wood/metal/yin) with radialGradient cores, element-color shadowBlur halos, and 6-step pixel trail.
  5. Hit/explosion panel: Click-triggered or auto-demo particle burst (16 colored pixels + white core pixels) + ring shockwave with animated radius expansion.
  6. Full battle scene demo (960×300): 3 towers auto-target and fire at 3 moving enemies; complete VFX pipeline: bullet homing trail → hit particle burst → white flash + squash → death explosion (ring + scatter) → HP bar depletion → enemy auto-respawn.
  Purpose: Verify that the current sprite design quality is bounded by TILE_SIZE (16px display) not the matrix art detail, and establish baseline for deciding next steps (sprite redesign vs. effect layer upgrade vs. tile size increase).

## V0.30
### 2026-06-28 (60th Update)
- Resolved GitHub Actions push configuration.
  1. Release script: Included the newly created .github/workflows/deploy.yml in scripts/release.cjs git add parameters, ensuring the workflow config is properly committed and pushed.
### 2026-06-28 (59th Update)
- Resolved GitHub Pages MIME type (video/mp2t) loading error.
  1. CI/CD automation: Added GitHub Actions workflow (.github/workflows/deploy.yml) to automatically compile TS code and deploy the build target ('dist') to GitHub Pages on every push to main branch.
  2. Setup documentation: Guided user to change GitHub Pages source settings to use 'GitHub Actions'.
### 2026-06-28 (58th Update)
- Resolved GitHub Pages deployment issues where main menu buttons were unresponsive.
  1. Vite configuration: Created vite.config.ts and set base to './' to force Vite to compile assets with relative paths instead of absolute paths (which caused 404 resource errors on subpath deployments like GitHub Pages).
  2. Entry script: Changed script injection in index.html from absolute path /src/main.ts to relative path ./src/main.ts.
  3. Release process: Updated scripts/release.cjs to include vite.config.ts in Git commit index.
### 2026-06-28 (57th Update)
- Resolved Git repository safety and tracking issues by removing untracked dependencies and improving ignore rules.
  1. Untracked node_modules: Removed accidentally tracked `node_modules` from Git index via `git rm -r --cached` while preserving the local files.
  2. Untracked test images: Removed Stable Diffusion test output images `test_sd_monster.png` and `test_sd_monster_transparent.png` from Git index.
  3. Optimized .gitignore: Added ignore patterns for Python runtime caches (`__pycache__`, `.py[cod]`, `*$py.class`), virtual environments (`.venv`, `venv`, `env`), and custom SD test images (`test_sd_monster*.png`).
### 2026-06-28 (56th Update)
- Established versioning system starting at V0.1.0 (currently aligned to V0.155 / 55th Update).
  1. UI implementation: Added gameVersion div under the mainMenu subtitle in index.html, populated dynamically via GAME_VERSION in main.ts.
  2. Rule enforcement: Sub-version increments on each subsequent update. V [major].[minor] will only increment if a /release command is explicitly given.
  3. Synced package.json version to 0.1.55.
### 2026-06-28 (55th Update)
- Implemented Dead Cells style modern pixel mix visual upgrades in the main game.
  1. Default zoom: Auto-zooms mapScale to 2.0 and centers vertical offset to -320 when starting BATTLE on 80x40 large maps, rendering 16px sprites at 32px size for clarity.
  2. Scroll zoom: Registered desktop mouse wheel event listener on canvas to pan/scale around cursor.
  3. Element trail bullets: Remade bullets into glowing element cores with multi-stage alpha fading trails tracing target direction.
  4. Base shadows: Added translucent base shadow ellipses underneath pixel enemies to remove float feeling.
  5. Sprite glowing outlines: Applied element-specific shadowBlur glows on pixel towers/enemies and a bright red glow on hit-flashing.
  6. Death shockwaves: Spawn expanding colored shockwave rings on monster deaths.
### 2026-06-28 (54th Update)
- Created showcase.html: Standalone visual quality showcase page to validate the visual ceiling of existing 16×16 pixel sprite matrices.
  1. Renders all sprites at 4× scale (sprites.ts-compatible drawPixelSprite logic ported to vanilla JS).
  2. Tower display: Three Lv1 towers (Fire/Water/Yang) with shadowBlur glow, breathing squash/stretch animation, orbiting element particles; one Lv2 Fire tower (16×24 isometric sprite) with level star indicator.
  3. Enemy display: Snake (2-frame walk) and Dragon Boss (2-frame wing flap) with sway animation; automatic hit-flash (white fill + red shadowBlur) + squash + element particle burst every 2.2s.
  4. Bullet effects: 5 element-typed bullets (fire/water/wood/metal/yin) with radialGradient cores, element-color shadowBlur halos, and 6-step pixel trail.
  5. Hit/explosion panel: Click-triggered or auto-demo particle burst (16 colored pixels + white core pixels) + ring shockwave with animated radius expansion.
  6. Full battle scene demo (960×300): 3 towers auto-target and fire at 3 moving enemies; complete VFX pipeline: bullet homing trail → hit particle burst → white flash + squash → death explosion (ring + scatter) → HP bar depletion → enemy auto-respawn.
  Purpose: Verify that the current sprite design quality is bounded by TILE_SIZE (16px display) not the matrix art detail, and establish baseline for deciding next steps (sprite redesign vs. effect layer upgrade vs. tile size increase).

## V0.20
### 2026-06-28 (56th Update)
- Established versioning system starting at V0.1.0 (currently aligned to V0.155 / 55th Update).
  1. UI implementation: Added gameVersion div under the mainMenu subtitle in index.html, populated dynamically via GAME_VERSION in main.ts.
  2. Rule enforcement: Sub-version increments on each subsequent update. V [major].[minor] will only increment if a /release command is explicitly given.
  3. Synced package.json version to 0.1.55.
### 2026-06-28 (55th Update)
- Implemented Dead Cells style modern pixel mix visual upgrades in the main game.
  1. Default zoom: Auto-zooms mapScale to 2.0 and centers vertical offset to -320 when starting BATTLE on 80x40 large maps, rendering 16px sprites at 32px size for clarity.
  2. Scroll zoom: Registered desktop mouse wheel event listener on canvas to pan/scale around cursor.
  3. Element trail bullets: Remade bullets into glowing element cores with multi-stage alpha fading trails tracing target direction.
  4. Base shadows: Added translucent base shadow ellipses underneath pixel enemies to remove float feeling.
  5. Sprite glowing outlines: Applied element-specific shadowBlur glows on pixel towers/enemies and a bright red glow on hit-flashing.
  6. Death shockwaves: Spawn expanding colored shockwave rings on monster deaths.
### 2026-06-28 (54th Update)
- Created showcase.html: Standalone visual quality showcase page to validate the visual ceiling of existing 16×16 pixel sprite matrices.
  1. Renders all sprites at 4× scale (sprites.ts-compatible drawPixelSprite logic ported to vanilla JS).
  2. Tower display: Three Lv1 towers (Fire/Water/Yang) with shadowBlur glow, breathing squash/stretch animation, orbiting element particles; one Lv2 Fire tower (16×24 isometric sprite) with level star indicator.
  3. Enemy display: Snake (2-frame walk) and Dragon Boss (2-frame wing flap) with sway animation; automatic hit-flash (white fill + red shadowBlur) + squash + element particle burst every 2.2s.
  4. Bullet effects: 5 element-typed bullets (fire/water/wood/metal/yin) with radialGradient cores, element-color shadowBlur halos, and 6-step pixel trail.
  5. Hit/explosion panel: Click-triggered or auto-demo particle burst (16 colored pixels + white core pixels) + ring shockwave with animated radius expansion.
  6. Full battle scene demo (960×300): 3 towers auto-target and fire at 3 moving enemies; complete VFX pipeline: bullet homing trail → hit particle burst → white flash + squash → death explosion (ring + scatter) → HP bar depletion → enemy auto-respawn.
  Purpose: Verify that the current sprite design quality is bounded by TILE_SIZE (16px display) not the matrix art detail, and establish baseline for deciding next steps (sprite redesign vs. effect layer upgrade vs. tile size increase).

## V0.1.0
- **現代像素混合風特效**：
  - 怪物與防禦塔加入五行屬性發光，受擊時亮紅光閃白。
  - 怪物腳底新增軟陰影，消除漂浮感。
  - 死亡時新增向外擴散的五行屬性環狀衝擊波。
- **大尺寸地圖預設放大**：
  - 80x40 關卡預設以 2.0x 載入，16px 精靈呈現為 32px 物理像素，能見度更清晰。
  - 支援滑鼠拖曳平移地圖與電腦端滾輪縮放。
- **元素追蹤拖影子彈**：
  - 子彈升級為帶有發光核心的彗星，並自動朝飛行反方向繪製多段漸消拖尾。
- **音效池與優化**：
  - 優化音效加載，防止 Chrome 報錯與 GC 停頓，效能大幅提升。
- **版本號系統**：
  - 引進主選單版本標示與更新日誌。
