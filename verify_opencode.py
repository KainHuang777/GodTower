# verify_opencode.py
# 用於驗證 opencode.json 的配置是否正確，並測試 package.json 的 script 執行與專案編譯狀態。

import os
import sys
import json
import subprocess

# 避免 Windows 終端機預設 CP950 編碼印出 Unicode 符號時發生崩潰
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def verify_opencode():
    print("==================================================")
    print("         OpenCode 相關設置與專案建置自檢         ")
    print("==================================================")
    
    # 1. 檢查 opencode.json 檔案是否存在與 JSON 語法
    opencode_path = os.path.join(os.path.dirname(__file__), "opencode.json")
    if not os.path.exists(opencode_path):
        print("❌ [FAIL] 找不到 opencode.json 檔案。")
        sys.exit(1)
        
    try:
        with open(opencode_path, "r", encoding="utf-8") as f:
            opencode_data = json.load(f)
        print("✅ [OK] opencode.json 存在且 JSON 格式解析成功。")
    except Exception as e:
        print(f"❌ [FAIL] opencode.json 解析失敗，可能存在語法錯誤: {e}")
        sys.exit(1)
        
    # 2. 檢查 package.json 是否存在與 JSON 語法
    package_path = os.path.join(os.path.dirname(__file__), "package.json")
    if not os.path.exists(package_path):
        print("❌ [FAIL] 找不到 package.json 檔案。")
        sys.exit(1)
        
    try:
        with open(package_path, "r", encoding="utf-8") as f:
            package_data = json.load(f)
        print("✅ [OK] package.json 存在且 JSON 格式解析成功。")
    except Exception as e:
        print(f"❌ [FAIL] package.json 解析失敗: {e}")
        sys.exit(1)

    # 3. 比對 opencode.json 中定義的 command 是否與 package.json scripts 相符
    commands = opencode_data.get("command", {})
    if not isinstance(commands, dict):
        print("❌ [FAIL] opencode.json 中的 command 格式不正確，應為物件 (object)。")
        sys.exit(1)
        
    package_scripts = package_data.get("scripts", {})
    
    print("\n[驗證 command 項目]")
    errors_found = False
    for name, item in commands.items():
        if not isinstance(item, dict):
            print(f" ❌ 項目 '{name}' 格式不正確：必須為物件 (object)。")
            errors_found = True
            continue
            
        template = item.get("template")
        description = item.get("description", "")
        
        if not template:
            print(f" ❌ 項目 '{name}' 格式不完整：缺少 template。")
            errors_found = True
            continue
            
        print(f" - 檢查項目: {name} (指令範本: '{template}', 說明: '{description}')")
        
        # 驗證對應的 package.json scripts
        if template.startswith("npm run "):
            script_key = template[len("npm run "):].strip()
            if script_key in package_scripts:
                print(f"   ✅ [OK] 對應 package.json 中的 script: \"{script_key}\" -> \"{package_scripts[script_key]}\"")
            else:
                print(f"   ❌ [FAIL] package.json scripts 中找不到 \"{script_key}\" 指令")
                errors_found = True
        else:
            print(f"   ⚠️ [WARN] 指令 '{template}' 不是以 'npm run ' 開頭，請確認這是否為預期行為。")

    if errors_found:
        print("\n❌ 發現配置不一致或格式錯誤，請修正上述問題。")
        sys.exit(1)
    else:
        print("\n✅ 所有配置項與 package.json 一致性檢查通過！")

    # 4. 執行 npm run build 測試編譯
    print("\n==================================================")
    print(" 嘗試執行 'npm run build' 來檢查專案是否可成功編譯... ")
    print("==================================================")
    
    try:
        # 在 Windows 環境中執行 npm 需要啟用 shell=True
        result = subprocess.run("npm run build", shell=True, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        if result.returncode == 0:
            print("🎉 [SUCCESS] 專案 TypeScript 編譯與 Vite 打包完全正常！")
            print("\n--- 打包輸出資訊 ---")
            print(result.stdout.strip())
        else:
            print("❌ [FAIL] 'npm run build' 執行失敗！")
            print("\n--- 錯誤輸出 ---")
            print(result.stderr.strip() or result.stdout.strip())
            sys.exit(1)
    except Exception as e:
        print(f"❌ [FAIL] 無法啟動 npm run build 進程，請確認 Node.js 與 npm 是否已正確安裝並加入環境變數: {e}")
        sys.exit(1)

if __name__ == "__main__":
    verify_opencode()
