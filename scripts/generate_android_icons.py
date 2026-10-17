#!/usr/bin/env python3
"""
Generate all Android mipmap launcher icons and adaptive icons from public/logo.png
"""
import os
import sys

def generate_icons():
    try:
        from PIL import Image
    except ImportError:
        print("[IconGen] Pillow not installed, installing via pip...")
        os.system(f"{sys.executable} -m pip install pillow")
        from PIL import Image

    logo_path = 'public/logo.png'
    if not os.path.exists(logo_path):
        print(f"[IconGen] Error: {logo_path} not found.")
        sys.exit(1)

    res_dir = 'android/app/src/main/res'
    if not os.path.exists(res_dir):
        print(f"[IconGen] Note: {res_dir} does not exist yet.")
        return

    img = Image.open(logo_path).convert('RGBA')

    # Densities: (folder_name, legacy_icon_size, adaptive_foreground_size)
    densities = [
        ('mipmap-mdpi', 48, 108),
        ('mipmap-hdpi', 72, 162),
        ('mipmap-xhdpi', 96, 216),
        ('mipmap-xxhdpi', 144, 324),
        ('mipmap-xxxhdpi', 192, 432),
    ]

    for folder, l_size, fg_size in densities:
        target_dir = os.path.join(res_dir, folder)
        os.makedirs(target_dir, exist_ok=True)

        # 1. Standard Launcher Icon (ic_launcher.png)
        l_img = img.resize((l_size, l_size), Image.Resampling.LANCZOS)
        l_img.save(os.path.join(target_dir, 'ic_launcher.png'), 'PNG')

        # 2. Round Launcher Icon (ic_launcher_round.png)
        l_img.save(os.path.join(target_dir, 'ic_launcher_round.png'), 'PNG')

        # 3. Adaptive Foreground Icon (ic_launcher_foreground.png)
        fg_img = img.resize((fg_size, fg_size), Image.Resampling.LANCZOS)
        fg_img.save(os.path.join(target_dir, 'ic_launcher_foreground.png'), 'PNG')

        print(f"[IconGen] Generated {folder}: legacy {l_size}x{l_size}, foreground {fg_size}x{fg_size}")

    # Set adaptive background color to dark matching logo (#0B0F15)
    values_dir = os.path.join(res_dir, 'values')
    os.makedirs(values_dir, exist_ok=True)
    bg_xml_path = os.path.join(values_dir, 'ic_launcher_background.xml')
    with open(bg_xml_path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0F15</color>\n</resources>\n')

    # Ensure app name in strings.xml is JKT48 Live
    strings_xml_path = os.path.join(values_dir, 'strings.xml')
    if os.path.exists(strings_xml_path):
        with open(strings_xml_path, 'r', encoding='utf-8') as f:
            content = f.read()
        import re
        content = re.sub(r'<string name="app_name">.*?</string>', '<string name="app_name">JKT48 Live</string>', content)
        content = re.sub(r'<string name="title_activity_main">.*?</string>', '<string name="title_activity_main">JKT48 Live</string>', content)
        with open(strings_xml_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("[IconGen] Updated strings.xml app_name to 'JKT48 Live'")

    print("[IconGen] All Android launcher icons successfully updated!")

if __name__ == '__main__':
    generate_icons()
