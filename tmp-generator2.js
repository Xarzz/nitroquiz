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

let trackAssets = [];
let currentZ = 60; // Start at segment 60
const MAX_Z = 2200; // Finish line is around 2250

const miscLeft = [
    "/assets/material/bangku/1.png"
];

const miscRight = [
    "/assets/material/bangku/1.png"
];

const pohon = ["/assets/material/pohon/2.webp", "/assets/material/pohon/4.webp"];

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
            z: currentZ + (Math.random() > 0.5 ? 5 : 0), // Slight stagger
            side: 'right',
            src: `/assets/material/kanan_jalan/${kananFiles[idxKanan]}`
        });
        idxKanan = (idxKanan + 1) % kananFiles.length;
    }

    // Add first wave of decorations (vending machines/benches)
    trackAssets.push({
        z: currentZ + 12,
        side: 'left',
        src: randomMisc(miscLeft)
    });
    
    trackAssets.push({
        z: currentZ + 18,
        side: 'right',
        src: randomMisc(miscRight)
    });
    
    // Add Trees between buildings
    trackAssets.push({
        z: currentZ + 25,
        side: 'left',
        src: randomMisc(pohon)
    });
    
    trackAssets.push({
        z: currentZ + 32,
        side: 'right',
        src: randomMisc(pohon)
    });

    // Advance Z by 43 segments to make it closely packed like before (was +40 earlier) but distinct
    currentZ += 43;
}

const fileContent = `const trackAssets = ${JSON.stringify(trackAssets, null, 4)};\nexport default trackAssets;\n`;

fs.writeFileSync(path.join(basePath, 'src/lib/trackAssets.ts'), fileContent);
console.log('Done generating trackAssets.ts. Total items:', trackAssets.length, 'Max Z:', currentZ);
