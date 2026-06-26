# verify_setup.py
# 用於驗證專案核心檔案的完整性，並指引啟動方式。

import os
import sys

def check_files():
    required_files = [
        "package.json",
        "tsconfig.json",
        "index.html",
        "src/main.ts",
        "Update.txt",
        "docs/AI_Coding_Guidelines.md",
        "docs/GDD.md"
    ]
    
    print("=== Checkpoint Maze TD 專案自檢 ===")
    all_exist = True
    for f in required_files:
        path = os.path.join(os.path.dirname(__file__), f)
        if os.path.exists(path):
            print(f"[OK] 檔案存在: {f}")
        else:
            print(f"[FAIL] 缺少檔案: {f}")
            all_exist = False
            
    if all_exist:
        print("\n🎉 所有核心檔案驗證成功！")
        print("\n您可以選擇以下兩種方式之一來運行遊戲：")
        print("--------------------------------------------------")
        print("方法 A (推薦，支援熱重載與 TypeScript 編譯)：")
        print("  1. 開啟終端機並切換至此目錄。")
        print("  2. 運行命令: npm install")
        print("  3. 運行命令: npm run dev")
        print("  4. 瀏覽器打開顯示的網址 (例如 http://localhost:5173)。")
        print("--------------------------------------------------")
        print("方法 B (快速預覽，免裝 Node 依賴，直接以 HTML/JS 運行)：")
        print("  * 注意：因為 main.ts 為 TypeScript 且包含 import，")
        print("    直接以靜態網頁開啟會因為瀏覽器不支持 TS 而報錯。")
        print("    建議使用 方法 A 進行編譯與調試。")
        print("--------------------------------------------------")
    else:
        print("\n❌ 專案檔案不完整，請檢查缺失的檔案。")
        sys.exit(1)

if __name__ == "__main__":
    check_files()
