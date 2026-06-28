# SD 精靈圖提示詞設計指南 (Stable Diffusion Prompt Guidelines)

> 本文件記錄所有遊戲精靈圖的 Stable Diffusion 提示詞設計，包含共通風格設定、
> 各角色專屬提示詞，以及推薦的生成參數配置。
>
> **使用方式：** 配合 `sd_batch_generate.py` 批量腳本使用，提示詞已內嵌於腳本的 `SPRITE_CONFIG` 字典中。

---

## 共通風格設定

### Positive Prompt 共通前綴
```
pixel art, game sprite, chinese wuxing fantasy theme, solid white background,
16-bit style, vibrant colors, clean edges, top-down slightly angled view,
no shadows, no gradients, crisp pixels
```

### Negative Prompt（所有圖共用）
```
photorealistic, 3d render, photography, dark background, shadow, blur,
gradient background, extra limbs, deformed, ugly, bad anatomy,
low quality, watermark, text, border, frame, multiple characters
```

### 推薦 SD 生成參數
| 參數 | 建議值 |
|------|--------|
| Steps | 25–30 |
| CFG Scale | 7.0–8.0 |
| Sampler | DPM++ 2M Karras |
| Width × Height | 512×512（去背後可縮放至 64×64） |
| Seed | -1（隨機），確定後固定種子以重現 |

---

## 怪物提示詞設計

### 1. 小蛇 (`snake`) — 木屬性
```
pixel art, game sprite, chinese wuxing fantasy, green snake monster,
scales texture, glowing green eyes, standing upright, serpent, 
solid white background, 16-bit style, vibrant green tones,
small cute but menacing, side view
```

### 2. 小蒼蠅 (`fly`) — 金屬性（飛行）
```
pixel art, game sprite, chinese wuxing fantasy, metallic fly insect monster,
silver armor plated wings, compound eyes glowing silver, buzzing wings,
hovering pose, aerial creature, solid white background, 16-bit style,
metallic grey tones, gold highlights
```

### 3. 火蜥蜴 (`salamander`) — 火屬性
```
pixel art, game sprite, chinese wuxing fantasy, fire salamander lizard monster,
flames on its back, ember red and orange scales, walking pose, lizard body,
fire breath ready, solid white background, 16-bit style, red orange tones,
glowing ember spots
```

### 4. 水靈 (`water_spirit`) — 水屬性
```
pixel art, game sprite, chinese wuxing fantasy, water spirit elemental monster,
translucent blue water body, flowing wave form, ethereal ghost like creature,
chinese mythological water spirit, solid white background, 16-bit style,
sky blue cyan tones, ripple effects around body
```

### 5. 石傀儡 (`golem`) — 土屬性
```
pixel art, game sprite, chinese wuxing fantasy, stone golem monster,
ancient chinese stone guardian, rocky body, carved stone texture,
broad powerful stance, earth tones, solid white background, 16-bit style,
grey brown stone, glowing eyes, chunky proportions, imposing
```

### 6. 金甲蟲 (`beetle`) — 金屬性
```
pixel art, game sprite, chinese wuxing fantasy, golden scarab beetle monster,
shiny gold carapace, metallic shell, six legs visible, beetle horns,
side view walking pose, solid white background, 16-bit style,
golden yellow tones, polished metal sheen on shell
```

### 7. 龍影 Boss (`boss_dragon`) — 火屬性（飛行）
```
pixel art, game sprite, chinese wuxing fantasy, shadow dragon boss monster,
chinese dragon, dark red scales, large spread wings, flying pose,
breathing fire, intimidating aura, powerful, chinese mythological dragon,
solid white background, 16-bit style, dark crimson deep red tones,
glowing golden eyes, scale detail, 96x96 boss size
```

---

## 砲台提示詞設計

### 共通砲台風格
> 所有砲台應呈現「古代中國建築塔樓」為基底，加上各屬性的元素特效。
> 視角：正面略俯視 (top-down isometric feel)，突顯塔的立體感。

---

### 基礎塔 Lv1

#### 1. 烈焰塔 (`fire`) — 火屬性
```
pixel art, game sprite, chinese wuxing fantasy, fire element defense tower,
chinese pagoda tower with flames, burning lanterns, red orange fire aura,
ancient stone base with fire motifs, solid white background, 16-bit style,
crimson red deep orange tones, flames dancing on top
```

#### 2. 冰凍塔 (`water`) — 水屬性
```
pixel art, game sprite, chinese wuxing fantasy, water ice element defense tower,
chinese pagoda tower with ice crystals, frozen pillars, blue white ice shards,
water droplets and frost patterns, solid white background, 16-bit style,
deep navy sky blue ice white tones, crystalline texture
```

#### 3. 纏繞塔 (`wood`) — 木屬性
```
pixel art, game sprite, chinese wuxing fantasy, wood nature element defense tower,
chinese pagoda tower overgrown with vines, tree roots wrapping the stone,
leaves and branches sprouting, moss covered, solid white background, 16-bit style,
dark green emerald forest green tones, nature overgrown aesthetic
```

#### 4. 岩壁塔 (`earth`) — 土屬性（純障礙牆）
```
pixel art, game sprite, chinese wuxing fantasy, earth stone wall defense tower,
solid stone wall block, ancient chinese fortress stone brick,
earth clay texture, rammed earth construction aesthetic, chunky block shape,
solid white background, 16-bit style, brown earth stone grey tones,
no magical effects, purely structural
```

#### 5. 鏡刃塔 (`metal`) — 金屬性
```
pixel art, game sprite, chinese wuxing fantasy, metal blade element defense tower,
chinese pagoda tower with spinning sword blades, metallic silver armor plating,
sharp blades jutting outward, polished mirror surface, solid white background,
16-bit style, steel silver gunmetal tones, gleaming metal highlights
```

#### 6. 暗影塔 (`yin`) — 陰屬性
```
pixel art, game sprite, chinese wuxing fantasy, yin shadow dark element defense tower,
chinese pagoda tower shrouded in darkness, purple black aura, void energy wisps,
dark moon crescent symbol, shadow tendrils, solid white background, 16-bit style,
deep purple indigo black tones, glowing purple runes, mysterious energy
```

#### 7. 聖光塔 (`yang`) — 陽屬性
```
pixel art, game sprite, chinese wuxing fantasy, yang solar holy light defense tower,
chinese pagoda tower radiating golden light, sun disc halo, holy light rays,
golden phoenix feathers, divine energy, solid white background, 16-bit style,
golden amber warm yellow tones, bright light emanating, sacred divine energy
```

---

### Lv2 同系強化塔

> Lv2 塔需在 Lv1 的基礎上，視覺強化：加大尺寸感、加強光效、更豐富的細節。
> 提示詞在 Lv1 基礎上追加以下後綴：

**Lv2 共通追加詞：**
```
upgraded level 2, more powerful, enhanced magical aura, glowing energy,
more detailed, ornate decorations, bigger size impression, evolved form
```

| typeId | 追加特色描述 |
|--------|-------------|
| `fire_2` | `intense inferno, pillar of fire, volcanic eruption energy` |
| `water_2` | `blizzard snowstorm, ice spike crown, frozen aura` |
| `wood_2` | `giant ancient tree, dense canopy, glowing forest spirit` |
| `earth_2` | `fortified fortress wall, reinforced battlements` |
| `metal_2` | `sword storm, spinning blade vortex, mirror shards everywhere` |
| `yin_2` | `void portal, reality cracking shadow, corruption energy` |
| `yang_2` | `solar flare burst, angelic light wings, divine pillar beam` |

---

### 異系配方合成塔

#### 1. 焚林塔 (`wood_fire`) — 木＋火 → 火
```
pixel art, game sprite, chinese wuxing fantasy, forest fire inferno defense tower,
burning ancient tree, blazing forest pillar, fire burning through overgrown wood,
nature consumed by flame, erupting burning vines, solid white background,
16-bit style, dark orange red burnt wood tones, dramatic fire engulfing tree tower
```

#### 2. 熔岩塔 (`fire_earth`) — 火＋土 → 土
```
pixel art, game sprite, chinese wuxing fantasy, lava magma volcano defense tower,
chinese pagoda tower made of volcanic rock, lava flowing through cracks,
glowing magma veins, molten rock, erupting volcano core,
solid white background, 16-bit style, dark volcanic black red glowing orange tones
```

#### 3. 鍛造塔 (`earth_metal`) — 土＋金 → 金（強化周圍友方）
```
pixel art, game sprite, chinese wuxing fantasy, forge anvil smith defense tower,
ancient chinese forge tower, burning forge furnace inside,
golden gears and metal cogs, weapon racks, buff aura radiating outward,
supportive glowing golden energy field, solid white background, 16-bit style,
earth stone and polished gold tones, craftsman energy
```

#### 4. 寒鐵塔 (`metal_water`) — 金＋水 → 水
```
pixel art, game sprite, chinese wuxing fantasy, frozen blade frost defense tower,
ice encrusted metal tower, silver blades frozen in ice,
winter frost metal armor, razor sharp frozen spikes, ice coating metal,
solid white background, 16-bit style, steel blue ice silver metallic tones,
frost crystalline metal aesthetic
```

#### 5. 靈木塔 (`water_wood`) — 水＋木 → 木（生成臨時障礙）
```
pixel art, game sprite, chinese wuxing fantasy, water nature spirit tree defense tower,
magical cherry blossom tree tower, water flowing through wood roots,
spirit blossoms blooming, root walls emerging from ground,
mystical water nature fusion, solid white background, 16-bit style,
emerald green and pale blue water wood tones, magical flower petals
```

#### 6. 太極塔 (`yin_yang`) — 陰＋陽 → 太極（真實傷害）
```
pixel art, game sprite, chinese wuxing fantasy, taiji yin yang cosmic defense tower,
spinning yin yang symbol tower, half dark half light swirling energy,
perfect balance of shadow and light, cosmic void and divine radiance,
taoist symbol rotating, solid white background, 16-bit style,
black white swirling with purple gold cosmic energy, transcendent power
```

---

## 去背參數建議

使用 `sd_batch_generate.py` 內建的白底去背演算法時，可調整以下參數：

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `threshold` | 240 | 白色偵測閾值，越低去除越多接近白的顏色 |
| `edge_soften` | False | 是否啟用邊緣柔化（建議精靈圖保持 False 以維持像素感） |

> ⚠️ **注意：** 白底去背方式對含白色細節的角色（如聖光塔、水靈）可能誤去背。
> 建議這些角色使用 SD 的 RemBG 後處理，或手動在 Photoshop/GIMP 修整。
