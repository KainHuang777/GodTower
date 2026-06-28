# sd_batch_generate.py
# 批量生成五行迷宮塔防所有怪物與砲台的 SD 精靈圖，並自動去背存檔。
#
# 使用方式：
#   python sd_batch_generate.py              → 生成所有圖（跳過已存在的檔案）
#   python sd_batch_generate.py --force      → 強制重新生成所有圖
#   python sd_batch_generate.py --category enemies  → 只生成怪物類別
#   python sd_batch_generate.py --id snake   → 只生成指定 ID 的圖
#   python sd_batch_generate.py --dry-run    → 列出所有任務但不執行
#
# 依賴：pip install requests Pillow

import os
import sys
import time
import base64
import argparse
from typing import Optional

try:
    import requests
except ImportError:
    print("❌ 缺少 requests 模組，請執行: pip install requests")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("❌ 缺少 Pillow 模組，請執行: pip install Pillow")
    sys.exit(1)

# ============================================================
# 設定
# ============================================================

SD_API_BASE = "http://10.20.60.37:7860/sdapi/v1"

# 共通 Prompt 前綴
COMMON_POSITIVE_PREFIX = (
    "8-bit pixel art, retro game sprite, wuxing theme, isolated on pure solid white background, "
    "minimal style, clean borders, crisp pixels, "
)

# 共通 Negative Prompt
COMMON_NEGATIVE = (
    "photorealistic, 3d render, card, frame, border, text, description, card game, "
    "board game, playing card, landscape background, sky, cloud, grass, trees, "
    "shadow, low quality, watermark, multiple characters"
)

# 共通生成參數
DEFAULT_PARAMS = {
    "steps": 28,
    "cfg_scale": 7.5,
    "width": 512,
    "height": 512,
    "sampler_name": "DPM++ 2M Karras",
    "seed": -1,
}

# 輸出根目錄（相對於腳本所在位置）
OUTPUT_BASE = "assets/sprites"

# ============================================================
# 精靈圖設定清單
# ============================================================
# 格式：
#   "category/filename_no_ext" : {
#       "prompt": <角色專屬 prompt（不含共通前綴）>,
#       "size": (width, height),  ← 選填，預設 512x512
#   }

SPRITE_CONFIG = {
    # ── 怪物 ─────────────────────────────────────────────────
    "enemies/snake": {
        "prompt": (
            "green snake monster, scales texture, glowing green eyes, "
            "standing upright coiled serpent, side view, small cute but menacing, "
            "vibrant green tones"
        ),
    },
    "enemies/fly": {
        "prompt": (
            "metallic fly insect monster, silver armor plated wings, "
            "compound eyes glowing silver, buzzing wings spread, hovering pose, "
            "aerial creature, metallic grey tones, gold highlights"
        ),
    },
    "enemies/salamander": {
        "prompt": (
            "fire salamander lizard monster, flames erupting on its back, "
            "ember red and orange scales, walking pose, lizard body, fire breath ready, "
            "red orange tones, glowing ember spots"
        ),
    },
    "enemies/water_spirit": {
        "prompt": (
            "water spirit elemental monster, translucent blue water body, "
            "flowing wave form, ethereal ghost-like creature, "
            "chinese mythological water spirit, sky blue cyan tones, "
            "ripple effects around body"
        ),
    },
    "enemies/golem": {
        "prompt": (
            "stone golem monster, ancient chinese stone guardian, rocky body, "
            "carved stone texture, broad powerful stance, earth tones, "
            "grey brown stone, glowing eyes, chunky proportions, imposing"
        ),
    },
    "enemies/beetle": {
        "prompt": (
            "golden scarab beetle monster, shiny gold carapace, metallic shell, "
            "six legs visible, beetle horns, side view walking pose, "
            "golden yellow tones, polished metal sheen on shell"
        ),
    },
    "enemies/boss_dragon": {
        "prompt": (
            "shadow dragon boss monster, chinese dragon, dark red scales, "
            "large spread wings, flying pose, breathing fire, intimidating aura, "
            "chinese mythological dragon, dark crimson deep red tones, "
            "glowing golden eyes, scale detail, powerful boss creature"
        ),
        "size": (768, 768),
    },

    # ── 基礎砲台 Lv1 ──────────────────────────────────────────
    "towers/fire": {
        "prompt": (
            "fire element defense tower, chinese pagoda tower with flames, "
            "burning lanterns, red orange fire aura, ancient stone base with fire motifs, "
            "crimson red deep orange tones, flames dancing on top"
        ),
    },
    "towers/water": {
        "prompt": (
            "water ice element defense tower, chinese pagoda tower with ice crystals, "
            "frozen pillars, blue white ice shards, water droplets and frost patterns, "
            "deep navy sky blue ice white tones, crystalline texture"
        ),
    },
    "towers/wood": {
        "prompt": (
            "wood nature element defense tower, chinese pagoda tower overgrown with vines, "
            "tree roots wrapping stone, leaves and branches sprouting, moss covered, "
            "dark green emerald forest green tones, nature overgrown aesthetic"
        ),
    },
    "towers/earth": {
        "prompt": (
            "earth stone wall defense tower, solid stone wall block, "
            "ancient chinese fortress stone brick, earth clay texture, "
            "rammed earth construction aesthetic, chunky block shape, "
            "brown earth stone grey tones, purely structural no magical effects"
        ),
    },
    "towers/metal": {
        "prompt": (
            "metal blade element defense tower, chinese pagoda tower with spinning sword blades, "
            "metallic silver armor plating, sharp blades jutting outward, "
            "polished mirror surface, steel silver gunmetal tones, gleaming metal highlights"
        ),
    },
    "towers/yin": {
        "prompt": (
            "yin shadow dark element defense tower, chinese pagoda tower shrouded in darkness, "
            "purple black aura, void energy wisps, dark moon crescent symbol, "
            "shadow tendrils, deep purple indigo black tones, glowing purple runes"
        ),
    },
    "towers/yang": {
        "prompt": (
            "yang solar holy light defense tower, chinese pagoda tower radiating golden light, "
            "sun disc halo, holy light rays, golden phoenix feathers, divine energy, "
            "golden amber warm yellow tones, bright light emanating"
        ),
    },

    # ── 同系 Lv2 強化塔 ───────────────────────────────────────
    "towers_lv2/fire_2": {
        "prompt": (
            "fire element defense tower level 2 upgraded, chinese pagoda tower, "
            "intense inferno pillar of fire, volcanic eruption energy, "
            "crimson red tones, enhanced magical fire aura, bigger more powerful"
        ),
    },
    "towers_lv2/water_2": {
        "prompt": (
            "water ice element defense tower level 2 upgraded, chinese pagoda tower, "
            "blizzard snowstorm, ice spike crown, frozen aura, "
            "deep navy ice white tones, enhanced frozen power, bigger more powerful"
        ),
    },
    "towers_lv2/wood_2": {
        "prompt": (
            "wood nature element defense tower level 2 upgraded, chinese pagoda tower, "
            "giant ancient tree, dense canopy, glowing forest spirit energy, "
            "dark green tones, enhanced nature magic aura, bigger more powerful"
        ),
    },
    "towers_lv2/earth_2": {
        "prompt": (
            "earth stone wall defense tower level 2 upgraded, fortified fortress wall, "
            "reinforced battlements, reinforced ancient chinese stone walls, "
            "brown earth stone grey tones, sturdier more imposing structure"
        ),
    },
    "towers_lv2/metal_2": {
        "prompt": (
            "metal blade element defense tower level 2 upgraded, chinese pagoda tower, "
            "sword storm spinning blade vortex, mirror shards everywhere, "
            "steel silver tones, enhanced blade energy aura, bigger more powerful"
        ),
    },
    "towers_lv2/yin_2": {
        "prompt": (
            "yin shadow dark element defense tower level 2 upgraded, chinese pagoda tower, "
            "void portal reality cracking shadow corruption energy, "
            "deep purple black tones, enhanced void power, bigger more powerful"
        ),
    },
    "towers_lv2/yang_2": {
        "prompt": (
            "yang solar holy light defense tower level 2 upgraded, chinese pagoda tower, "
            "solar flare burst angelic light wings divine pillar beam, "
            "golden warm tones, enhanced divine radiance, bigger more powerful"
        ),
    },

    # ── 異系配方合成塔 ────────────────────────────────────────
    "towers_recipe/wood_fire": {
        "prompt": (
            "forest fire inferno defense tower, burning ancient tree, "
            "blazing forest pillar, fire burning through overgrown wood, "
            "nature consumed by flame, erupting burning vines, "
            "dark orange red burnt wood tones, dramatic fire engulfing tree"
        ),
    },
    "towers_recipe/fire_earth": {
        "prompt": (
            "lava magma volcano defense tower, chinese pagoda tower made of volcanic rock, "
            "lava flowing through cracks, glowing magma veins, molten rock, "
            "dark volcanic black red glowing orange tones"
        ),
    },
    "towers_recipe/earth_metal": {
        "prompt": (
            "forge anvil smith defense tower, ancient chinese forge tower, "
            "burning forge furnace, golden gears and metal cogs, weapon racks, "
            "buff aura radiating outward golden energy field, "
            "earth stone and polished gold tones, craftsman energy"
        ),
    },
    "towers_recipe/metal_water": {
        "prompt": (
            "frozen blade frost defense tower, ice encrusted metal tower, "
            "silver blades frozen in ice, winter frost metal armor, "
            "razor sharp frozen spikes, frost crystalline metal, "
            "steel blue ice silver metallic tones"
        ),
    },
    "towers_recipe/water_wood": {
        "prompt": (
            "water nature spirit tree defense tower, magical cherry blossom tree tower, "
            "water flowing through wood roots, spirit blossoms blooming, "
            "root walls emerging from ground, mystical water nature fusion, "
            "emerald green and pale blue water wood tones, magical flower petals"
        ),
    },
    "towers_recipe/yin_yang": {
        "prompt": (
            "taiji yin yang cosmic defense tower, spinning yin yang symbol tower, "
            "half dark half light swirling energy, perfect balance shadow and light, "
            "cosmic void and divine radiance, taoist symbol rotating, "
            "black white swirling with purple gold cosmic energy, transcendent power"
        ),
    },
}

# ============================================================
# 核心功能
# ============================================================

def test_connection() -> bool:
    """測試 SD API 連線"""
    print(f"🔗 正在連線至 SD API: {SD_API_BASE}")
    try:
        resp = requests.get(f"{SD_API_BASE}/sd-models", timeout=10)
        if resp.status_code == 200:
            models = resp.json()
            print(f"✅ 連線成功！可用模型數量：{len(models)}")
            for m in models[:3]:
                print(f"   - {m.get('title', '???')}")
            return True
        else:
            print(f"❌ 伺服器回應異常 (status={resp.status_code})")
            return False
    except Exception as e:
        print(f"❌ 無法連線：{e}")
        return False


def generate_image(sprite_key: str, config: dict) -> Optional[bytes]:
    """呼叫 SD txt2img API 生成一張圖片，回傳 PNG bytes（失敗回傳 None）"""
    w, h = config.get("size", (512, 512))
    full_prompt = COMMON_POSITIVE_PREFIX + config["prompt"]
    payload = {
        **DEFAULT_PARAMS,
        "prompt": full_prompt,
        "negative_prompt": COMMON_NEGATIVE,
        "width": w,
        "height": h,
    }
    try:
        resp = requests.post(f"{SD_API_BASE}/txt2img", json=payload, timeout=120)
        if resp.status_code == 200:
            images = resp.json().get("images", [])
            if images:
                return base64.b64decode(images[0])
        print(f"   ⚠️  API 回應異常 (status={resp.status_code})")
    except Exception as e:
        print(f"   ⚠️  請求發生異常：{e}")
    return None


def remove_white_background(img_bytes: bytes, threshold: int = 240) -> bytes:
    """將接近白色的背景轉為透明，回傳 PNG bytes"""
    from io import BytesIO
    img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    data = img.getdata()
    new_data = []
    for r, g, b, a in data:
        if r >= threshold and g >= threshold and b >= threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    buf = BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def resolve_output_path(sprite_key: str) -> str:
    """將 'enemies/snake' 轉為完整輸出路徑 'assets/sprites/enemies/snake.png'"""
    return os.path.join(OUTPUT_BASE, sprite_key + ".png")


# ============================================================
# 主流程
# ============================================================

def run_batch(args):
    # 篩選任務
    tasks = {}
    for key, cfg in SPRITE_CONFIG.items():
        category = key.split("/")[0]
        sprite_id = key.split("/")[1]

        if args.category and category != args.category:
            continue
        if args.id and sprite_id != args.id:
            continue
        tasks[key] = cfg

    if not tasks:
        print("⚠️  沒有符合條件的任務，請確認 --category 或 --id 參數。")
        return

    print(f"\n📋 待生成任務共 {len(tasks)} 張：")
    for k in tasks:
        out = resolve_output_path(k)
        exists = "✅ 已存在" if os.path.exists(out) else "⬜ 未產"
        print(f"   [{exists}] {out}")

    if args.dry_run:
        print("\n🔍 Dry-run 模式，不執行生成。")
        return

    # 連線測試
    if not test_connection():
        print("\n❌ 無法連線至 Stable Diffusion API，請確認服務已啟動。")
        sys.exit(1)

    success_count = 0
    skip_count = 0
    fail_count = 0

    print(f"\n🚀 開始批量生成...\n")
    for i, (key, cfg) in enumerate(tasks.items(), 1):
        out_path = resolve_output_path(key)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        if os.path.exists(out_path) and not args.force:
            print(f"[{i:02d}/{len(tasks):02d}] ⏩ 跳過（已存在）: {out_path}")
            skip_count += 1
            continue

        print(f"[{i:02d}/{len(tasks):02d}] 🎨 生成中: {key}")

        img_bytes = generate_image(key, cfg)
        if img_bytes is None:
            print(f"         ❌ 生成失敗，跳過。")
            fail_count += 1
            continue

        transparent_bytes = remove_white_background(img_bytes)
        with open(out_path, "wb") as f:
            f.write(transparent_bytes)
        print(f"         ✅ 已儲存: {out_path}")
        success_count += 1

        # 避免對 API 發送請求過快
        if i < len(tasks):
            time.sleep(0.5)

    print(f"\n{'='*55}")
    print(f"✅ 完成：{success_count} 張  |  ⏩ 跳過：{skip_count} 張  |  ❌ 失敗：{fail_count} 張")
    print(f"{'='*55}")
    if fail_count > 0:
        print("⚠️  有失敗項目，可使用 --id <id> 單獨重試，或確認 SD API 狀態。")


def parse_args():
    parser = argparse.ArgumentParser(
        description="五行迷宮塔防 — SD 精靈圖批量產圖工具"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="強制重新生成（覆蓋已存在的檔案）"
    )
    parser.add_argument(
        "--category",
        choices=["enemies", "towers", "towers_lv2", "towers_recipe"],
        help="只生成指定類別"
    )
    parser.add_argument(
        "--id", metavar="SPRITE_ID",
        help="只生成指定 ID 的精靈圖（例如：snake, fire, wood_fire）"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="列出所有待生成任務但不執行"
    )
    return parser.parse_args()


if __name__ == "__main__":
    print("=" * 55)
    print("  五行迷宮塔防 — SD 精靈圖批量產圖工具")
    print("=" * 55)
    run_batch(parse_args())
