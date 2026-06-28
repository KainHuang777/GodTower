# fix_transparency.py
# 解決五行迷宮塔防中 SD 精靈圖未成功去背的問題。
# 本工具提供兩種去背模式：
#   1. Flood Fill 模式 (預設)：從邊緣擴散去背，防止圖片內部的白色（如金屬反光或翅膀）被挖空。
#   2. Global 模式：直接將整張圖所有大於閾值的亮色像素全部轉為透明。
#
# 使用方式：
#   python fix_transparency.py              → 預設使用 Flood Fill 模式去背
#   python fix_transparency.py --mode global → 使用全域替換模式去背
#   python fix_transparency.py --threshold 230 → 自訂亮度閾值 (0-255，預設 230)

import os
import sys
import argparse
from collections import deque

try:
    from PIL import Image
except ImportError:
    print("❌ 缺少 Pillow 模組，請先執行: pip install Pillow")
    sys.exit(1)

SPRITE_DIR = "assets/sprites"

def is_near_white(color, threshold=230):
    # color 可以是 (r, g, b) 或 (r, g, b, a)
    r, g, b = color[0], color[1], color[2]
    return r >= threshold and g >= threshold and b >= threshold

def flood_fill_transparency(img_path, threshold=230):
    """
    使用泛洪填充演算法 (Flood Fill) 去除背景。
    從圖片四周邊緣的亮色像素開始擴散，只把與邊緣相連的亮色區域轉為透明，
    保護角色主體內部的亮色像素（避免破面）。
    """
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    # 記錄已訪問的像素座標
    visited = set()
    # 待處理的隊列
    queue = deque()
    
    # 將四周邊緣且接近白色的像素作為 Flood Fill 的起點種子
    # 上下兩橫行
    for x in range(width):
        for y in [0, height - 1]:
            if is_near_white(pixels[x, y], threshold):
                queue.append((x, y))
                visited.add((x, y))
    # 左右兩縱列
    for y in range(1, height - 1):
        for x in [0, width - 1]:
            if is_near_white(pixels[x, y], threshold):
                queue.append((x, y))
                visited.add((x, y))
                
    # BFS 擴散
    while queue:
        cx, cy = queue.popleft()
        # 將該背景像素設為完全透明
        r, g, b, _ = pixels[cx, cy]
        pixels[cx, cy] = (r, g, b, 0)
        
        # 檢查 4 個相鄰像素
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in visited and is_near_white(pixels[nx, ny], threshold):
                    visited.add((nx, ny))
                    queue.append((nx, ny))
                    
    return img

def global_transparency(img_path, threshold=230):
    """
    全域亮色替換模式。
    直接將整張圖片所有大於或等於閾值的亮色像素全部替換為透明。
    """
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    for y in range(height):
        for x in range(width):
            if is_near_white(pixels[x, y], threshold):
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
                
    return img

def main():
    parser = argparse.ArgumentParser(description="五行迷宮塔防 — SD 精靈圖高品質去背修復工具")
    parser.add_argument("--mode", choices=["flood", "global"], default="flood",
                        help="去背模式：flood (邊緣泛洪填充，推薦) 或 global (全域替換)")
    parser.add_argument("--threshold", type=int, default=230,
                        help="亮度閾值 (0-255)，大於等於此值的接近白色像素會被轉為透明，預設 230")
    args = parser.parse_args()

    if not os.path.exists(SPRITE_DIR):
        print(f"❌ 找不到目錄: {SPRITE_DIR}")
        sys.exit(1)
        
    print("=" * 65)
    print("  五行迷宮塔防 — PNG 精靈圖高品質去背修復工具")
    print(f"  執行模式: {args.mode.upper()}  | 亮度閾值: {args.threshold}")
    print("=" * 65)
    
    categories = ["enemies", "towers", "towers_lv2", "towers_recipe"]
    processed_count = 0
    
    for category in categories:
        cat_dir = os.path.join(SPRITE_DIR, category)
        if not os.path.exists(cat_dir):
            continue
            
        print(f"\n📂 正在處理類別: {category}/")
        files = [f for f in os.listdir(cat_dir) if f.lower().endswith(".png")]
        files.sort()
        
        for file in files:
            filepath = os.path.join(cat_dir, file)
            
            if args.mode == "flood":
                processed_img = flood_fill_transparency(filepath, args.threshold)
            else:
                processed_img = global_transparency(filepath, args.threshold)
                
            processed_img.save(filepath, "PNG")
            print(f"   - {file:<18} | 去背完成並已覆蓋儲存")
            processed_count += 1
            
    print("\n" + "=" * 65)
    print(f"🎉 處理完成！共成功重新去背了 {processed_count} 張圖片。")
    print("💡 提示：請重新整理您的瀏覽器網頁以檢視最新去背效果。")
    print("=" * 65)

if __name__ == "__main__":
    main()
