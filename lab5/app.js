'use strict';

const AutomatonAgent = require('./agent');

function getArg(flag, fallback) {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return fallback;
    return process.argv[index + 1];
}

function getNumberArg(flag, fallback) {
    const value = Number(getArg(flag, fallback));
    return Number.isFinite(value) ? value : fallback;
}

const host = getArg('--host', '127.0.0.1');
const port = getNumberArg('--port', 6000);
const attackTeam = getArg('--attack-team', 'teamA');
const defendTeam = getArg('--defend-team', 'teamB');
const debug = process.argv.includes('--debug');

const agents = [
    new AutomatonAgent({
        teamName: attackTeam,
        host,
        port,
        role: 'attacker',
        goalie: false,
        start: { x: -12, y: 0 },
        debug,
    }),
    new AutomatonAgent({
        teamName: defendTeam,
        host,
        port,
        role: 'goalie',
        goalie: true,
        start: { x: 50, y: 0 },
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
