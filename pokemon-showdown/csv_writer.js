import fs from 'fs';
import simulate_pair from './simulate_random_pair.js';

async function write_to_csv() {
    const trials = 100;
    const result = await simulate_pair(trials);
    const csvLine = `\n${result.numA},${result.numB},${result.winrateA}`;
    fs.appendFileSync('winrates.csv', csvLine);
}

for (let i = 0; i < 100; i++) {
    write_to_csv();
}