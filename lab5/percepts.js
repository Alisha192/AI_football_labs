'use strict';

const { globalObjectPosition } = require('../lab2/lib/localization');

function nearest(objects, predicate) {
    let best = null;
    for (const obj of objects) {
        if (!predicate(obj)) continue;
        if (obj.distance === null) continue;
        if (!best || obj.distance < best.distance) {
            best = obj;
        }
    }
    return best;
}

function byName(objects, name) {
    return nearest(objects, (obj) => obj.name === name);
}

function buildContext(agent, world, filteredObjects) {
    const ball = byName(filteredObjects, 'b');
    const ownGoal = byName(filteredObjects, agent.ownGoalName());
    const goalOpp = byName(filteredObjects, agent.opponentGoalName());

    const nearestOpponent = nearest(filteredObjects, (obj) => obj.kind === 'player' && obj.team && obj.team !== agent.teamName);
    const nearestMate = nearest(filteredObjects, (obj) => obj.kind === 'player' && (!obj.team || obj.team === agent.teamName));

    return {
        time: world.time,
        pose: world.pose,
        ball,
        ballPrev: agent.lastBall,
        ownGoal,
        goalOpp,
        nearestOpponent,
        nearestMate,
        ballGlobal: world.pose && ball ? globalObjectPosition(world.pose, ball) : null,
    };
}

module.exports = {
    buildContext,
};
