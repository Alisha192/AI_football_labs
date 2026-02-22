'use strict';

const { clamp, normalizeAngle } = require('../../lab2/lib/math');

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
        const angle = input.goalOpp ? input.goalOpp.direction : input.opponentGoalAngleGlobal;
        if (typeof angle !== 'number') {
            return null;
        }

        const dist = input.goalOpp ? input.goalOpp.distance : input.opponentGoalDistanceGlobal;
        if (typeof dist !== 'number') {
            return null;
        }

        if (dist > 25 && !input.features.opponentPressure) {
            return { n: 'kick', v: [25, angle] };
        }

        const power = dist > 22 ? 100 : 80;
        return { n: 'kick', v: [clamp(power, 30, 100), angle] };
    }

    choosePassTarget(input) {
        const mates = [];
        const opponents = [];

        for (const obj of input.filtered) {
            if (obj.kind !== 'player') continue;
            if (obj.distance === null || obj.direction === null) continue;
            if (Math.abs(obj.direction) > 80) continue;

            const isOpponent = !!obj.team && obj.team !== input.agent.teamName;
            if (isOpponent) {
                opponents.push(obj);
            } else {
                mates.push(obj);
            }
        }

        function isLaneBlocked(target) {
            // Конус передачи: чем дальше адресат, тем уже допуск по углу.
            // Для близкого паса позволяем чуть шире, для длинного — строже.
            const cone = clamp(14 - target.distance * 0.25, 5, 14);
            for (const opp of opponents) {
                if (opp.distance >= target.distance - 0.3) continue;
                const rel = Math.abs(normalizeAngle(opp.direction - target.direction));
                if (rel <= cone) return true;
            }
            return false;
        }

        const safeMates = mates.filter((mate) => !isLaneBlocked(mate));
        if (safeMates.length === 0) {
            return null;
        }

        let preferred = null;
        if (input.assignment.receiverId) {
            preferred = safeMates.find((mate) => mate.unum === input.assignment.receiverId) || null;
        }
        if (preferred) return preferred;

        // Если координатор не назначил явного получателя, выбираем безопасный
        // вариант с хорошим соотношением "близко + прямо по курсу".
        safeMates.sort((a, b) => {
            const sa = a.distance + Math.abs(a.direction) * 0.06;
            const sb = b.distance + Math.abs(b.direction) * 0.06;
            if (sa !== sb) return sa - sb;
            return a.distance - b.distance;
        });
        return safeMates[0] || null;
    }
}

module.exports = HighController;
