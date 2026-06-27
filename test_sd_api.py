# test_sd_api.py
# 用於測試本地/內網 Stable Diffusion WebUI API 並示範如何生成透明背景的像素風遊戲精靈素材。

import os
import sys
import base64
import json

try:
    import requests
except ImportError:
    print("❌ 缺少 requests 模組，請先執行: pip install requests")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("❌ 缺少 Pillow 模組，請先執行: pip install Pillow")
    sys.exit(1)

SD_API_BASE = "http://10.20.60.37:7860/sdapi/v1"

def test_api_connection():
    print("1. 正在檢查 SD API 連線與載入模型...")
    url = f"{SD_API_BASE}/sd-models"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            models = response.json()
            print(f"✅ 連線成功！載入的模型：")
            for m in models:
                print(f"   - {m.get('title')}")
            return True
        else:
            print(f"❌ 連線失敗，伺服器回應狀態碼: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 無法連線至 SD API ({url}): {e}")
        return False

def make_background_transparent(img_path, threshold=240):
    """
    將圖片接近白色的背景轉為透明。
    """
    print(f"3. 正在進行去背處理: {img_path}")
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # 如果 R, G, B 三個通道都大於閾值，則將 Alpha 設為 0 (透明)
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    output_path = img_path.replace(".png", "_transparent.png")
    img.save(output_path, "PNG")
    print(f"🎉 去背完成！已儲存至: {output_path}")
    return output_path

def generate_test_sprite():
    print("\n2. 正在向 txt2img 發送請求生成測試像素精靈...")
    url = f"{SD_API_BASE}/txt2img"
    
    # 針對 SD 1.5 像素風精靈圖的 Prompts
    payload = {
        "prompt": "pixel art, a cute red dragon monster, standing, side view, game sprite, solid white background, 8-bit, vibrant colors",
        "negative_prompt": "photorealistic, 3d, rendering, real world, dark background, shadows, lowres, bad quality, borders, frames",
        "steps": 20,
        "cfg_scale": 7.5,
        "width": 512,
        "height": 512,
        "sampler_name": "Euler a",
        "seed": -1
    }
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            images = result.get("images", [])
            if not images:
                print("❌ 伺服器未回傳圖片資料。")
                return
            
            # 解碼第一張圖片
            img_data = base64.b64decode(images[0])
            output_name = "test_sd_monster.png"
            with open(output_name, "wb") as f:
                f.write(img_data)
            print(f"✅ 成功生成原始圖片: {output_name}")
            
            # 進行去背
            make_background_transparent(output_name)
        else:
            print(f"❌ 請求失敗，狀態碼: {response.status_code}, 回應: {response.text}")
    except Exception as e:
        print(f"❌ 生成請求發生異常: {e}")

if __name__ == "__main__":
    print("==================================================")
    print("         Stable Diffusion API 產圖自檢工具         ")
    print("==================================================")
    if test_api_connection():
        generate_test_sprite()
