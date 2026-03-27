const fs = require('fs');
const path = 'd:/DATAATAR/UBIG/balap/src/lib/trackAssets.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Double the distance between objects
// And apply extra gap if objects are buildings that might overlap due to their size
data.sort((a,b) => a.z - b.z);

const FACTOR = 2.5;
data.forEach(item => {
    item.z = Math.round(item.z * FACTOR);
});

fs.writeFileSync(path, JSON.stringify(data, null, 4));
console.log('Track assets scaled successfully 2.5x');
