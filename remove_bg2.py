import os
from PIL import Image
from collections import deque

dirs = ["public/assets/material/kanan_jalan", "public/assets/material/kiri_jalan"]

def remove_background(img_path):
    print(f"Processing: {img_path}")
    try:
        img = Image.open(img_path).convert("RGBA")
        width, height = img.size
        pixels = img.load()

        # Count opaque black pixels
        black_count = 0
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if r < 20 and g < 20 and b < 20 and a > 100:
                    black_count += 1

        print(f"  Size: {width}x{height}, Opaque black pixels: {black_count}")

        if black_count < 500:
            print("  Skipped (not enough black to justify removal)")
            return

        # Flood fill from all edges to remove connected black regions
        visited = set()
        queue = deque()

        def is_dark(x, y):
            r, g, b, a = pixels[x, y]
            return r < 25 and g < 25 and b < 25

        # Seed from all edge pixels that are dark
        for x in range(width):
            if is_dark(x, 0):
                queue.append((x, 0)); visited.add((x, 0))
            if is_dark(x, height - 1):
                queue.append((x, height - 1)); visited.add((x, height - 1))
        for y in range(height):
            if is_dark(0, y):
                queue.append((0, y)); visited.add((0, y))
            if is_dark(width - 1, y):
                queue.append((width - 1, y)); visited.add((width - 1, y))

        # BFS flood fill
        while queue:
            cx, cy = queue.popleft()
            pixels[cx, cy] = (0, 0, 0, 0)  # Make transparent

            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    visited.add((nx, ny))
                    if is_dark(nx, ny):
                        queue.append((nx, ny))

        img.save(img_path, "PNG")
        removed = sum(1 for x in range(width) for y in range(height) if pixels[x, y][3] == 0)
        print(f"  Done! Transparent pixels now: {removed}")

    except Exception as e:
        print(f"  Error: {e}")

for d in dirs:
    if os.path.exists(d):
        for f in sorted(os.listdir(d)):
            if f.endswith(".png"):
                remove_background(os.path.join(d, f))
