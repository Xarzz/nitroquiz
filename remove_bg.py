import os
from PIL import Image

dirs = ["public/assets/material/kanan_jalan", "public/assets/material/kiri_jalan"]

def remove_background(img_path):
    print(f"Processing: {img_path}")
    try:
        # Open the image and ensure it has an alpha channel
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        # We will assume black (0,0,0) or near black is the background
        # Let's count how many pixels are true black.
        black_count = sum(1 for item in datas if item[0] < 10 and item[1] < 10 and item[2] < 10 and item[3] > 100)
        
        # Sometimes tools export transparency as white or black. 
        # If it already has transparent pixels, do we still need to remove black?
        transparent_count = sum(1 for item in datas if item[3] < 10)
        print(f"  Black pixels: {black_count}, Transparent pixels: {transparent_count}")
        
        # Only process if there's very little transparency to begin with and a lot of black
        if transparent_count < 100 and black_count > 1000:
            print("  Removing black background with flood fill from corners...")
            
            width, height = img.size
            # Create a separate mask image initialized to 255 (opaque)
            mask = Image.new("L", (width, height), 255)
            
            # Helper function to check if a pixel is "background color"
            # Here we target black. We use BFS for flood fill.
            def is_black(rgb):
                return rgb[0] < 15 and rgb[1] < 15 and rgb[2] < 15
                
            visited = set()
            pixels = img.load()
            mask_pixels = mask.load()
            
            # Start flood fill from corners if they are black
            corners = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
            queue = []
            
            for cx, cy in corners:
                if is_black(pixels[cx, cy]):
                    queue.append((cx, cy))
                    visited.add((cx, cy))
                    
            # Add borders
            for x in range(width):
                if is_black(pixels[x, 0]) and (x, 0) not in visited: queue.append((x, 0)); visited.add((x, 0))
                if is_black(pixels[x, height-1]) and (x, height-1) not in visited: queue.append((x, height-1)); visited.add((x, height-1))
            for y in range(height):
                if is_black(pixels[0, y]) and (0, y) not in visited: queue.append((0, y)); visited.add((0, y))
                if is_black(pixels[width-1, y]) and (width-1, y) not in visited: queue.append((width-1, y)); visited.add((width-1, y))

            # BFS
            while queue:
                x, y = queue.pop(0)
                # Set mask pixel to 0 (transparent)
                mask_pixels[x, y] = 0
                
                # Check neighbors
                for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        if (nx, ny) not in visited:
                            visited.add((nx, ny))
                            if is_black(pixels[nx, ny]):
                                queue.append((nx, ny))
                                
            # Apply mask to alpha channel
            img.putalpha(mask)
            img.save(img_path, "PNG")
            print("  Saved!")
        else:
            print("  Skipped (already transparent or not a black bg)")
    except Exception as e:
        print(f"Failed to process {img_path}: {e}")

for d in dirs:
    if os.path.exists(d):
        for f in os.listdir(d):
            if f.endswith(".png"):
                remove_background(os.path.join(d, f))
