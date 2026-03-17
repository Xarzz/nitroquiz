import os
from PIL import Image
from collections import deque

# Fix specifically 1indosat.png which has large black regions
# For this file, we'll be more aggressive - remove ALL pure black pixels

def fix_indosat(img_path):
    print(f"Fixing: {img_path}")
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    count = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Pure black or near-black with full opacity -> make transparent
            if r < 15 and g < 15 and b < 15 and a > 100:
                pixels[x, y] = (0, 0, 0, 0)
                count += 1
    
    img.save(img_path, "PNG")
    print(f"  Removed {count} black pixels")

# Fix the problematic files
problematic = [
    "public/assets/material/kanan_jalan/1indosat.png",
    "public/assets/material/kanan_jalan/mandiri-kanan.png",
    "public/assets/material/kanan_jalan/esteh_kanan.png",
    "public/assets/material/kanan_jalan/amanda_kanan.png",
    "public/assets/material/kanan_jalan/indihome-kanan.png",
    "public/assets/material/kanan_jalan/erafone_kanan.png",
    "public/assets/material/kiri_jalan/mandiri-kiri.png",
    "public/assets/material/kiri_jalan/amanda_kiri.png",
    "public/assets/material/kiri_jalan/esteh_kiri.png",
]

for p in problematic:
    if os.path.exists(p):
        fix_indosat(p)
