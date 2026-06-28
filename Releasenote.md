# 遊戲更新日誌 (Release Notes)

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
