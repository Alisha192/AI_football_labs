'use strict';

const { clamp } = require('../../lab2/lib/math');

class HighController {
    execute(input, next) {
        const strategic = this.strategicCommand(input);
        if (strategic) {
            return strategic;
        }
        return next(input);
    }

    strategicCommand(input) {
        const f = input.features || {};

        if (!f.canKick) {
            if (input.assignment.task === 'attack_ball' && input.ball && Math.abs(input.ball.direction) > 25) {
                return { n: 'turn', v: input.ball.direction };
            }
            return null;
        }

        if (input.role === 'goalie') {
            if (input.goalOpp && typeof input.goalOpp.direction === 'number') {
                return { n: 'kick', v: [95, input.goalOpp.direction] };
            }
            if (typeof input.opponentGoalAngleGlobal === 'number') {
                return { n: 'kick', v: [95, input.opponentGoalAngleGlobal] };
            }
            return { n: 'kick', v: [80, 0] };
        }

        const teammate = this.choosePassTarget(input);
        if (f.opponentPressure && teammate) {
            input.agent.pendingSay = 'go';
            return { n: 'kick', v: [45, teammate.direction] };
        }

        const shot = this.makeShotCommand(input);
        if (shot) {
            return shot;
        }

        if (teammate) {
            input.agent.pendingSay = 'go';
            return { n: 'kick', v: [35, teammate.direction] };
        }

        const sideKick = input.agent.agentId % 2 === 0 ? 35 : -35;
        return { n: 'kick', v: [25, sideKick] };
    }

    makeShotCommand(input) {
        if (input.goalOpp && typeof input.goalOpp.direction === 'number') {
            const power = input.goalOpp.distance > 22 ? 100 : 75;
            return { n: 'kick', v: [power, input.goalOpp.direction] };
        }

        if (typeof input.opponentGoalAngleGlobal !== 'number') {
            return null;
        }

        let power = 75;
        if (typeof input.opponentGoalDistanceGlobal === 'number') {
            power = clamp(Math.round(40 + input.opponentGoalDistanceGlobal * 1.1), 55, 100);
        }
        return { n: 'kick', v: [power, input.opponentGoalAngleGlobal] };
    }

    choosePassTarget(input) {
        let preferred = null;
        let fallback = null;

        for (const obj of input.filtered) {
            if (obj.kind !== 'player') continue;
            if (obj.distance === null || obj.direction === null) continue;
            if (obj.team && obj.team !== input.agent.teamName) continue;
            if (Math.abs(obj.direction) > 75) continue;

            if (!fallback || obj.distance < fallback.distance) {
                fallback = obj;
            }

            if (
                input.assignment.receiverId
                && obj.unum === input.assignment.receiverId
                && (!preferred || obj.distance < preferred.distance)
            ) {
                preferred = obj;
            }
        }

        return preferred || fallback;
    }
}

module.exports = HighController;
