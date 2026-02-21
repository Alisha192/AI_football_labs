'use strict';

const RouteAgent = require('./agent');

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
const startX = getNumberArg('--x', -15);
const startY = getNumberArg('--y', 0);
const debug = process.argv.includes('--debug');

const agent = new RouteAgent({
    teamName,
    host,
    port,
    debug,
    start: { x: startX, y: startY },
});

agent.startAgent();

process.on('SIGINT', () => {
    agent.stopAgent();
    process.exit(0);
});
