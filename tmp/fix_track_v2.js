const fs = require('fs');
const path = 'd:/DATAATAR/UBIG/balap/src/lib/trackAssets.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Restore 150 assets spread across original 2250 segments
data.sort((a,b) => a.z - b.z);

const targetMaxZ = 2100;
const currentMaxZ = Math.max(...data.map(d=>d.z));

let lastZLeft = 100;
let lastZRight = 100;
const MIN_GAP = 28; // Spacing of 28 segments (5600 units depth) fits well on a 2250-segment track for 150 items

const processed = data.map(item => {
    let newZ = Math.round(item.z * (targetMaxZ / currentMaxZ));
    
    if (item.side === 'left') {
        if (newZ < lastZLeft + MIN_GAP) {
            newZ = lastZLeft + MIN_GAP;
        }
        lastZLeft = newZ;
    } else {
        if (newZ < lastZRight + MIN_GAP) {
            newZ = lastZRight + MIN_GAP;
        }
        lastZRight = newZ;
    }
    
    return { ...item, z: newZ };
});

fs.writeFileSync(path, JSON.stringify(processed, null, 4));
console.log('Track assets successfully redistributed for clean spacing on original track.');
