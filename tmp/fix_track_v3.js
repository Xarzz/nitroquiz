const fs = require('fs');
const path = 'd:/DATAATAR/UBIG/balap/src/lib/trackAssets.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Goal: Fill full track (~2250 segments) by duplicating assets if needed.
// Maintain tight Gap 18.

const maxZLimit = 2150; // Leave a tiny buffer for finish line
const MIN_GAP = 18;

let lastZLeft = 15;
let lastZRight = 35;
let processed = [];

// Loop until we reach the track end
let i = 0;
while (lastZLeft + MIN_GAP < maxZLimit || lastZRight + MIN_GAP < maxZLimit) {
    let item = data[i % data.length]; // Duplicate by modulo
    let side = item.side;
    let target = side === 'left' ? lastZLeft : lastZRight;
    
    if (target + MIN_GAP < maxZLimit) {
        let newZ = target + MIN_GAP;
        processed.push({ ...item, z: newZ });
        if (side === 'left') lastZLeft = newZ;
        else lastZRight = newZ;
    }
    
    i++;
    // Fallback break to prevent infinite loops if something goes wrong
    if (i > 2000) break; 
}

fs.writeFileSync(path, JSON.stringify(processed, null, 4));
console.log(`Full Track Distribution: Spaced until Z=${maxZLimit} with ${processed.length} total assets.`);
