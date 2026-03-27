import json

# Adjust this file path as per the environment
file_path = "d:/DATAATAR/UBIG/balap/src/lib/trackAssets.json"

with open(file_path, "r") as f:
    data = json.load(f)

# Sort by Z to process in order
data.sort(key=lambda x: x['z'])

# Scaling factor to give more space
# If buildings were at 50, 60, 90, 100...
# Scaling by 2.5x makes them 125, 150, 225, 250...
# This doubles the gap between building clusters.
FACTOR = 2.5

new_data = []
for item in data:
    item['z'] = round(item['z'] * FACTOR)
    new_data.append(item)

with open(file_path, "w") as f:
    json.dump(new_data, f, indent=4)

print(f"Track assets scaled by {FACTOR}x")
