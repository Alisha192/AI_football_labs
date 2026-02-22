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

        const dribble = this.makeDribbleCommand(input);
        if (dribble) {
            return dribble;
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

        // Ближняя дистанция: стреляем по углам, а не в центр.
        // Оцениваем "забитость" двух направлений (+10/-10) по ближайшим соперникам.
        const leftAngle = normalizeAngle(angle - 10);
        const rightAngle = normalizeAngle(angle + 10);
        let leftCost = 0;
        let rightCost = 0;

        for (const obj of input.filtered) {
            if (obj.kind !== 'player') continue;
            if (!obj.team || obj.team === input.agent.teamName) continue;
            if (typeof obj.distance !== 'number' || typeof obj.direction !== 'number') continue;

            // Вес препятствия: ближний соперник и малый угловой разрыв — опаснее.
            const toLeft = Math.abs(normalizeAngle(obj.direction - leftAngle));
            const toRight = Math.abs(normalizeAngle(obj.direction - rightAngle));
            const weight = clamp((28 - obj.distance) / 28, 0, 1);

            if (toLeft < 22) leftCost += weight * (1 - toLeft / 22);
            if (toRight < 22) rightCost += weight * (1 - toRight / 22);
        }

        let shotAngle = angle;
        if (dist < 25) {
            if (leftCost < rightCost) shotAngle = leftAngle;
            else if (rightCost < leftCost) shotAngle = rightAngle;
            else shotAngle = angle >= 0 ? leftAngle : rightAngle;
        }

        const power = dist < 25 ? 100 : (dist > 22 ? 100 : 80);
        return { n: 'kick', v: [clamp(power, 30, 100), shotAngle] };
    }

    makeDribbleCommand(input) {
        const ball = input.ball;
        if (!ball || typeof ball.direction !== 'number') return null;

        let blockers = 0;
        for (const obj of input.filtered) {
            if (obj.kind !== 'player') continue;
            if (!obj.team || obj.team === input.agent.teamName) continue;
            if (typeof obj.distance !== 'number' || typeof obj.direction !== 'number') continue;
            if (obj.distance > 7.0) continue;

            const rel = Math.abs(normalizeAngle(obj.direction));
            if (rel <= 22) blockers += 1;
        }

        // Если впереди свободный коридор, прокидываем мяч себе на ход.
        if (blockers === 0) {
            return { n: 'kick', v: [18, 0] };
        }
        return null;
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
