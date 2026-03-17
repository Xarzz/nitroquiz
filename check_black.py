import os
from PIL import Image

dirs = ["public/assets/material/kanan_jalan", "public/assets/material/kiri_jalan"]
for d in dirs:
    for f in sorted(os.listdir(d)):
        if f.endswith(".png"):
            img = Image.open(os.path.join(d, f)).convert("RGBA")
            data = list(img.getdata())
            black = sum(1 for p in data if p[0] < 20 and p[1] < 20 and p[2] < 20 and p[3] > 100)
            print(f"{f}: black={black}")
