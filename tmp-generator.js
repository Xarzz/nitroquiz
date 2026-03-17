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
let currentZ = 50;

const maxLen = Math.max(kananFiles.length, kiriFiles.length);

const miscLeft = [
    "/assets/material/bangku/1.png"
];

const miscRight = [
    "/assets/material/bangku/1.png"
];

const randomMisc = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pohon = ["/assets/material/pohon/2.webp", "/assets/material/pohon/4.webp"];

// Spread assets out
for (let i = 0; i < maxLen; i++) {
    // Add Left Building
    if (i < kiriFiles.length) {
        trackAssets.push({
            z: currentZ,
            side: 'left',
            src: `/assets/material/kiri_jalan/${kiriFiles[i]}`
        });
    }

    // Add Right Building
    if (i < kananFiles.length) {
        trackAssets.push({
            z: currentZ + (Math.random() > 0.5 ? 10 : 0), // Slight stagger
            side: 'right',
            src: `/assets/material/kanan_jalan/${kananFiles[i]}`
        });
    }

    // Add decorations between buildings
    trackAssets.push({
        z: currentZ + 10,
        side: 'left',
        src: randomMisc(miscLeft)
    });

    trackAssets.push({
        z: currentZ + 15,
        side: 'right',
        src: randomMisc(miscRight)
    });

    trackAssets.push({
        z: currentZ + 20,
        side: 'left',
        src: randomMisc(pohon)
    });

    trackAssets.push({
        z: currentZ + 25,
        side: 'right',
        src: randomMisc(pohon)
    });

    currentZ += 40;
}

// Ensure trackLength bounds are respected in the game, currentZ is the max Z
fs.writeFileSync(path.join(basePath, 'src/lib/trackAssets.json'), JSON.stringify(trackAssets, null, 4));
console.log('Done generating trackAssets.json. Total items:', trackAssets.length, 'Max Z:', currentZ);
