# downscale_sprites.py
# Clean ASCII version to prevent encoding issues on Windows (CP950/MS950)

import os
from PIL import Image

SPRITE_DIR = "assets/sprites"

def process_images():
    print("Start scanning and compressing art assets...")
    success_count = 0
    skipped_count = 0
    
    if not os.path.exists(SPRITE_DIR):
        print(f"Error: Cannot find directory {SPRITE_DIR}")
        return

    for root, dirs, files in os.walk(SPRITE_DIR):
        for file in files:
            if file.endswith(".png"):
                path = os.path.join(root, file)
                try:
                    img = Image.open(path)
                    w, h = img.size
                    
                    # Boss is 96x96, others are 64x64
                    target_size = 96 if "boss" in file else 64
                    
                    if w == h:
                        if w != target_size:
                            print(f"Optimizing: {path} ({w}x{h} -> {target_size}x{target_size})")
                            img_resized = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
                            img_resized.save(path, "PNG")
                            success_count += 1
                        else:
                            skipped_count += 1
                    else:
                        print(f"Skipping spritesheet: {path} ({w}x{h})")
                        skipped_count += 1
                except Exception as e:
                    print(f"Error processing {path}: {e}")

    print(f"\nOptimization Completed!")
    print(f"   - Successfully optimized: {success_count} files")
    print(f"   - Skipped/Kept: {skipped_count} files")

if __name__ == "__main__":
    process_images()
