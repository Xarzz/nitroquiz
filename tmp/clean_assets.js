const fs = require('fs');
const path = require('path');

const publicDir = 'd:/DATAATAR/UBIG/balap/public';
const trackAssetsPath = 'd:/DATAATAR/UBIG/balap/src/lib/trackAssets.json';

const data = JSON.parse(fs.readFileSync(trackAssetsPath, 'utf8'));

console.log(`Original asset count: ${data.length}`);

const processed = data.filter(item => {
    if (!item.src) return false;
    
    // Convert /assets/file.webp to d:/.../public/assets/file.webp
    const fullPath = path.join(publicDir, item.src);
    
    if (fs.existsSync(fullPath)) {
        return true;
    } else {
        console.log(`REMOVING missing asset: ${item.src}`);
        return false;
    }
});

fs.writeFileSync(trackAssetsPath, JSON.stringify(processed, null, 4));
console.log(`Final asset count: ${processed.length}`);
