# check_sprites.py
# 診斷 assets/sprites 底下所有 PNG 精靈圖的透明通道與透明像素比例。
#
# 使用方式：
#   python check_sprites.py

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("❌ 缺少 Pillow 模組，請先執行: pip install Pillow")
    sys.exit(1)

SPRITE_DIR = "assets/sprites"

def check_image_transparency(filepath):
    try:
        with Image.open(filepath) as img:
            mode = img.mode
            width, height = img.size
            total_pixels = width * height
            
            if mode != "RGBA":
                # 沒有 RGBA 通道，表示完全沒有透明度
                return mode, 0.0, total_pixels, 0
            
            # 讀取像素
            data = img.getdata()
            transparent_count = sum(1 for pixel in data if pixel[3] == 0)
            percentage = (transparent_count / total_pixels) * 100.0
            return mode, percentage, total_pixels, transparent_count
    except Exception as e:
        return f"Error: {e}", 0.0, 0, 0

def main():
    if not os.path.exists(SPRITE_DIR):
        print(f"❌ 找不到目錄: {SPRITE_DIR}")
        sys.exit(1)
        
    print("=" * 65)
    print("  五行迷宮塔防 — PNG 精靈圖透明度診斷工具")
    print("=" * 65)
    
    categories = ["enemies", "towers", "towers_lv2", "towers_recipe"]
    failed_images = []
    total_checked = 0
    
    for category in categories:
        cat_dir = os.path.join(SPRITE_DIR, category)
        if not os.path.exists(cat_dir):
            print(f"⚠️ 找不到目錄: {cat_dir}，跳過。")
            continue
            
        print(f"\n📂 類別: {category}/")
        files = [f for f in os.listdir(cat_dir) if f.lower().endswith(".png")]
        files.sort()
        
        for file in files:
            filepath = os.path.join(cat_dir, file)
            mode, percentage, total, trans = check_image_transparency(filepath)
            total_checked += 1
            
            status = "🟢 正常" if percentage > 0 else "❌ 無透明 (純實心正方形)"
            print(f"   - {file:<18} | 格式: {mode:<5} | 透明度: {percentage:>5.1f}% | 狀態: {status}")
            
            if percentage == 0.0:
                failed_images.append(os.path.join(category, file))
                
    print("\n" + "=" * 65)
    print(f"📊 總結報告：共檢查了 {total_checked} 張圖片")
    if failed_images:
        print(f"❌ 警告：有 {len(failed_images)} 張圖片透明度為 0% (完全沒有去背成功)！")
        for f in failed_images:
            print(f"   - assets/sprites/{f}")
        print("\n💡 建議：請執行 python fix_transparency.py 來重新進行背景去背。")
    else:
        print("🟢 恭喜！所有圖片皆具備透明通道，去背狀態正常。")
    print("=" * 65)

if __name__ == "__main__":
    main()
