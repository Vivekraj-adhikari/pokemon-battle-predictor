import { simulatePair } from './battle_sim.js';

function getRandomId(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomPair() {
    const numA = getRandomId(1, 834);
    const numB = getRandomId(1, 834);
    return [numA, numB];
}

const simulate_pair = async (trials = 100) => {
    const [numA, numB] = getRandomPair();
    const result = await simulatePair(numA, numB, trials);
    return result;
}

simulate_pair();