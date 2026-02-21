'use strict';

const CoordinatedAgent = require('./agent');

function getArg(flag, fallback) {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return fallback;
    return process.argv[index + 1];
}

function getNumberArg(flag, fallback) {
    const value = Number(getArg(flag, fallback));
    return Number.isFinite(value) ? value : fallback;
}

const teamName = getArg('--team', 'teamA');
const host = getArg('--host', '127.0.0.1');
const port = getNumberArg('--port', 6000);
const debug = process.argv.includes('--debug');

const agents = [
    new CoordinatedAgent({
        teamName,
        host,
        port,
        role: 'passer',
        start: { x: -24, y: 0 },
        debug,
    }),
    new CoordinatedAgent({
        teamName,
        host,
        port,
        role: 'striker',
        start: { x: -22, y: -8 },
        debug,
    }),
];

for (const agent of agents) {
    agent.startAgent();
}

process.on('SIGINT', () => {
    for (const agent of agents) {
        agent.stopAgent();
    }
    process.exit(0);
});
