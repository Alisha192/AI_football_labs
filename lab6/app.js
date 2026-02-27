/**
 * @module lab6/app.js
 * Точка входа лабораторной работы: инициализирует агентов, роли и подключение к серверу симуляции.
 */

const Agent = require('./agent');
const Socket = require('./socket');
const low_ctrl = require("./field_player_low");
const high_ctrl = require("./field_player_high");
const VERSION = 7;

const goalie_low = require("./ctrl_low");
const goalie_middle = require("./ctrl_middle");
const goalie_high = require("./ctrl_high");

function getArg(flag, fallback) {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return fallback;
    return process.argv[index + 1];
}

function getNumberArg(flag, fallback) {
    const value = Number(getArg(flag, fallback));
    return Number.isFinite(value) ? value : fallback;
}

function createAgent(team, goalkeeper, controllers, bottom, top, center, start_x, start_y) {
    const agent = new Agent(team, goalkeeper);
    agent.bottom = bottom;
    agent.top = top;
    agent.center = center;
    agent.controllers = controllers;
    agent.start_x = start_x;
    agent.start_y = start_y;
    return agent;
}

function createGoalkeeper(team) {
    const goalkeeper = new Agent(team, true);
    goalkeeper.start_x = -50;
    goalkeeper.start_y = 0;
    goalkeeper.taken.action = "return";
    goalkeeper.taken.turnData = "ft0";
    goalkeeper.taken.wait = 0;
    goalkeeper.controllers = [goalie_low, goalie_middle, goalie_high];
    return goalkeeper;
}

async function connectAndMove(agent, teamName, host, port) {
    await Socket(agent, teamName, VERSION, agent.goalie, { host, port });
    await agent.socketSend('move', `${agent.start_x} ${agent.start_y}`);
}

(async () => {
    const host = getArg('--host', '127.0.0.1');
    const port = getNumberArg('--port', 6000);

    // Расстановка 10 полевых + 1 вратарь на каждую сторону.
    const A_team = [
        [-40, -20, -35, -40, -30],
        [-20, 0, -35, -40, -10],
        [0, 20, -35, -40, 10],
        [20, 40, 35, -40, 30],

        [-40, -20, -25, -25, -30],
        [-20, 0, -25, -25, -10],
        [0, 20, -25, -25, 10],
        [20, 40, -25, -25, 30],


        [-40, 0, -10, -10, -20],
        [0, 40, -10, -10, 20],
    ]

    const B_team = [
        [-40, -20, -35, -40, 30],
        [-20, 0, -35, -40, 10],
        [0, 20, -35, -40, -10],
        [20, 40, 35, -40, -30],

        [-40, -20, -25, -25, 30],
        [-20, 0, -25, -25, 10],
        [0, 20, -25, -25, -10],
        [20, 40, -25, -25, -30],


        [-40, 0, -10, -10, 20],
        [0, 40, -10, -10, -20],
    ]
    const players = [];

    for (const pl of A_team) {
        players.push(createAgent("A", false, [low_ctrl, high_ctrl],
            pl[1], pl[0], pl[2], pl[3], pl[4]));
    }

    for (const pl of B_team) {
        players.push(createAgent("B", false, [low_ctrl, high_ctrl],
            pl[1], pl[0], pl[2], pl[3], pl[4]));
    }

    const goalkeeper_A = createGoalkeeper("A");
    const goalkeeper_B = createGoalkeeper("B");
    const allAgents = [goalkeeper_A, goalkeeper_B, ...players];

    process.on('SIGINT', () => {
        // Корректно закрываем сокеты, чтобы порт освобождался сразу.
        for (const agent of allAgents) {
            if (agent.socket) agent.socket.close();
        }
        process.exit(0);
    });

    await connectAndMove(goalkeeper_A, "A", host, port);
    await connectAndMove(goalkeeper_B, goalkeeper_B.teamName, host, port);

    for (const player of players) {
        await connectAndMove(player, player.teamName, host, port);
    }
})();
