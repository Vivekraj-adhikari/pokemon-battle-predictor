const battle_simulator = require('./battle_sim');

function getRandomId(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomPair() {
    const numA = getRandomId(1, 834);
    const numB = getRandomId(1, 834);
    return [numA, numB];
}

simulatePair = async (trials = 50) => {
    const [numA, numB] = getRandomPair();
    const result = await battle_simulator.simulatePair(numA, numB, trials);
    console.log(result);
}