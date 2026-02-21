'use strict';

const TeamCoordinator = require('./coordinator');
const MultiPlayerAgent = require('./agent');

function getArg(flag, fallback) {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return fallback;
    return process.argv[index + 1];
}

function getNumberArg(flag, fallback) {
    const value = Number(getArg(flag, fallback));
    return Number.isFinite(value) ? value : fallback;
}

function createLayout(count) {
    const presets = [
        { role: 'striker', home: { x: -20, y: 0 }, followDx: 6, followDy: 0, goalie: false },
        { role: 'support_left', home: { x: -25, y: -12 }, followDx: 10, followDy: -8, goalie: false },
        { role: 'support_right', home: { x: -25, y: 12 }, followDx: 10, followDy: 8, goalie: false },
        { role: 'goalie', home: { x: -50, y: 0 }, followDx: 0, followDy: 0, goalie: true },
    ];

    const layout = {};
    for (let i = 1; i <= count; i += 1) {
        const preset = presets[i - 1] || {
            role: `support_${i}`,
            home: { x: -28, y: (i % 2 === 0 ? -1 : 1) * (6 + i) },
            followDx: 11,
            followDy: (i % 2 === 0 ? -1 : 1) * 8,
            goalie: false,
        };
        layout[i] = { ...preset, side: 'l' };
    }
    return layout;
}

const teamName = getArg('--team', 'teamA');
const host = getArg('--host', '127.0.0.1');
const port = getNumberArg('--port', 6000);
const playerCount = Math.max(2, getNumberArg('--players', 4));
const debug = process.argv.includes('--debug');

const layout = createLayout(playerCount);
const coordinator = new TeamCoordinator(layout);
const agents = [];

for (let id = 1; id <= playerCount; id += 1) {
    const info = layout[id];
    const agent = new MultiPlayerAgent({
        teamName,
        host,
        port,
        role: info.role,
        goalie: info.goalie,
        start: { ...info.home },
        agentId: id,
        coordinator,
        layout,
        debug,
    });
    agent.startAgent();
    agents.push(agent);
}

process.on('SIGINT', () => {
    for (const agent of agents) {
        agent.stopAgent();
    }
    process.exit(0);
});
