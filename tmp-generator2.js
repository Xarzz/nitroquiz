const fs = require('fs');
const path = require('path');

const basePath = process.cwd();
const kananDir = path.join(basePath, 'public/assets/material/kanan_jalan');
const kiriDir = path.join(basePath, 'public/assets/material/kiri_jalan');

let kananFiles = [];
let kiriFiles = [];

try {
    kananFiles = fs.readdirSync(kananDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));
} catch (e) {
    console.error("Error reading kanan_jalan", e);
}

try {
    kiriFiles = fs.readdirSync(kiriDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));
} catch (e) {
    console.error("Error reading kiri_jalan", e);
}

// Remove unwanted assets from filenames
const exclude = ['vending', 'news', 'trash', 'tempat_sampah'];
kananFiles = kananFiles.filter(f => !exclude.some(ex => f.toLowerCase().includes(ex)));
kiriFiles = kiriFiles.filter(f => !exclude.some(ex => f.toLowerCase().includes(ex)));

let trackAssets = [];
let currentZ = 60; 
const MAX_Z = 2240; 

const pohon = ["/assets/material/pohon/2.webp", "/assets/material/pohon/4.webp"];
const bangku = ["/assets/material/bangku/1.png"];
const semak = ["/assets/material/semak/1.webp", "/assets/material/semak/2.webp"];

const randomMisc = (arr) => arr[Math.floor(Math.random() * arr.length)];

let idxKiri = 0;
let idxKanan = 0;

while (currentZ <= MAX_Z) {
    // Add Left Building
    if (kiriFiles.length > 0) {
        trackAssets.push({
            z: currentZ,
            side: 'left',
            src: `/assets/material/kiri_jalan/${kiriFiles[idxKiri]}`
        });
        idxKiri = (idxKiri + 1) % kiriFiles.length;
    }
    
    // Add Right Building
    if (kananFiles.length > 0) {
        trackAssets.push({
            z: currentZ + (Math.random() > 5 ? 2 : 0), // Very slight stagger
            side: 'right',
            src: `/assets/material/kanan_jalan/${kananFiles[idxKanan]}`
        });
        idxKanan = (idxKanan + 1) % kananFiles.length;
    }

    // Add Decorations closely between buildings
    // With currentZ increment of 18, we can fit 2-3 items
    
    // 1. Trees or Bushes at +6
    trackAssets.push({
        z: currentZ + 6,
        side: Math.random() > 0.5 ? 'left' : 'right',
        src: randomMisc(pohon)
    });
    
    // 2. Bench or Bush at +12
    trackAssets.push({
        z: currentZ + 12,
        side: Math.random() > 0.5 ? 'left' : 'right',
        src: Math.random() > 0.7 ? randomMisc(bangku) : randomMisc(semak)
    });

    // Spacing by +18 makes it dense but allows for separation
    currentZ += 18;
}

const fileContent = `const trackAssets = ${JSON.stringify(trackAssets, null, 4)};\nexport default trackAssets;\n`;

fs.writeFileSync(path.join(basePath, 'src/lib/trackAssets.ts'), fileContent);
console.log('Done generating trackAssets.ts. Total items:', trackAssets.length, 'Max Z:', currentZ);
