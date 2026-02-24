'use strict';

const TeamCoordinator = require('./team_coordinator');
const TeamGameAgent = require('./agent');

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
    const base = [
        { role: 'goalie', home: { x: -50, y: 0 }, goalie: true },
        { role: 'defender_left', home: { x: -34, y: -12 }, goalie: false },
        { role: 'defender_right', home: { x: -34, y: 12 }, goalie: false },
        { role: 'midfielder', home: { x: -18, y: 0 }, goalie: false },
        { role: 'forward', home: { x: -8, y: 0 }, goalie: false },
    ];

    const layout = {};
    for (let i = 1; i <= count; i += 1) {
        const preset = base[i - 1] || {
            role: `support_${i}`,
            home: { x: -22, y: (i % 2 === 0 ? -1 : 1) * (5 + i) },
            goalie: false,
        };
        layout[i] = {
            role: preset.role,
            home: { ...preset.home },
            goalie: preset.goalie,
            side: 'l',
            mirrored: false,
        };
    }
    return layout;
}

function spawnTeam({ teamName, host, port, playerCount, debug }) {
    const layout = createLayout(playerCount);
    const coordinator = new TeamCoordinator(layout);
    const agents = [];

    for (let id = 1; id <= playerCount; id += 1) {
        const info = layout[id];
        const agent = new TeamGameAgent({
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

    return agents;
}

const host = getArg('--host', '127.0.0.1');
const port = getNumberArg('--port', 6000);
const teamA = getArg('--team-a', 'teamA');
const teamB = getArg('--team-b', 'teamB');
const players = Math.max(2, getNumberArg('--players', 5));
const singleTeam = process.argv.includes('--single-team');
const debug = process.argv.includes('--debug');

const allAgents = [];
allAgents.push(...spawnTeam({ teamName: teamA, host, port, playerCount: players, debug }));
if (!singleTeam) {
    allAgents.push(...spawnTeam({ teamName: teamB, host, port, playerCount: players, debug }));
}

process.on('SIGINT', () => {
    for (const agent of allAgents) {
        agent.stopAgent();
    }
    process.exit(0);
});
