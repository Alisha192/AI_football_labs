'use strict';

const { globalObjectPosition } = require('../../lab2/lib/localization');
const { getPoint } = require('../../lab2/lib/flags');
const { clamp, normalizeAngle } = require('../../lab2/lib/math');

class MiddleController {
    execute(input, next) {
        const { assignment } = input;
        const nav = input.agent.navigator;

        if (!input.command) {
            switch (assignment.task) {
            case 'attack_ball':
                input.command = this.attackBall(input, nav);
                break;
            case 'support_attack':
                input.command = this.moveToPoint(input, assignment.target, 2.0);
                break;
            case 'defend_lane':
                input.command = this.defendLane(input, nav);
                break;
            case 'seek_ball':
                input.command = this.seekBall(input, nav);
                break;
            case 'guard_goal':
                input.command = this.guardGoal(input, nav);
                break;
            case 'hold_zone':
            default:
                input.command = this.moveToPoint(input, assignment.target, 2.5);
                break;
            }
        }

        const command = next(input);
        return command || input.command;
    }

    hasReliablePose(input) {
        return !!(input.world.pose && input.world.pose.reliable !== false);
    }

    obstacles(input) {
        if (!input || !Array.isArray(input.filtered)) return [];
        return input.filtered.filter((obj) => (
            obj
            && obj.kind === 'player'
            && typeof obj.distance === 'number'
            && typeof obj.direction === 'number'
        ));
    }

    // [NEW] Глобальная позиция объекта по текущей позе агента.
    toGlobal(input, obj) {
        if (!this.hasReliablePose(input)) return null;
        if (!obj) return null;
        return globalObjectPosition(input.world.pose, obj);
    }

    // [NEW] Прогноз мяча на N тактов вперед.
    // Для быстрого катящегося мяча (сильный отрицательный distChange) используем горизонт 5..10,
    // чтобы бежать наперерез, а не в текущую точку.
    predictBall(input) {
        const ball = input.ball;
        if (!ball) return null;

        const hasDist = typeof ball.distChange === 'number' && Number.isFinite(ball.distChange);
        const hasDir = typeof ball.dirChange === 'number' && Number.isFinite(ball.dirChange);
        const fast = hasDist && ball.distChange < -0.08;

        let horizon = 2;
        if (fast) {
            horizon = clamp(Math.round(Math.abs(ball.distChange) * 40), 5, 10);
        }

        const predicted = {
            distance: ball.distance,
            direction: ball.direction,
        };
        if (hasDist) {
            predicted.distance = Math.max(0.1, ball.distance + ball.distChange * horizon);
        }
        if (hasDir) {
            predicted.direction = normalizeAngle(ball.direction + ball.dirChange * horizon);
        }

        const global = this.toGlobal(input, predicted);
        return {
            ...predicted,
            horizon,
            fast,
            global,
        };
    }

    // [NEW] Персональная опека: выбираем опасного соперника на своей половине
    // и ставим защитника между ним и своими воротами (на 1.5м от соперника к воротам).
    defendLane(input, nav) {
        if (!this.hasReliablePose(input)) {
            return nav.search(input.agent.runtime.searchStep++);
        }

        const ownGoal = getPoint(input.agent.ownGoalName());
        const side = input.agent.side || 'l';
        let danger = null;

        for (const obj of input.filtered) {
            if (obj.kind !== 'player') continue;
            if (!obj.team || obj.team === input.agent.teamName) continue;
            if (typeof obj.distance !== 'number' || typeof obj.direction !== 'number') continue;

            const global = this.toGlobal(input, obj);
            if (!global) continue;

            const inOwnHalf = side === 'l' ? global.x < 0 : global.x > 0;
            if (!inOwnHalf) continue;

            const toGoal = Math.hypot(global.x - ownGoal.x, global.y - ownGoal.y);
            if (!danger || toGoal < danger.toGoal) {
                danger = { obj, global, toGoal };
            }
        }

        if (!danger) {
            return this.moveToPoint(input, input.assignment.target, 2.5);
        }

        const gx = ownGoal.x - danger.global.x;
        const gy = ownGoal.y - danger.global.y;
        const norm = Math.max(1e-6, Math.hypot(gx, gy));
        const mark = {
            x: danger.global.x + (gx / norm) * 1.5,
            y: danger.global.y + (gy / norm) * 1.5,
        };

        const navPoint = nav.navigateToPoint(input.world.pose, mark, 1.5, this.obstacles(input));
        if (navPoint.command) return navPoint.command;
        if (navPoint.done) return { n: 'turn', v: danger.obj.direction };
        return nav.search(input.agent.runtime.searchStep++);
    }

    attackBall(input, nav) {
        if (!input.ball) {
            const target = input.assignment.target || { x: 0, y: 0 };
            if (!this.hasReliablePose(input)) {
                return nav.search(input.agent.runtime.searchStep++);
            }
            const navPoint = nav.navigateToPoint(input.world.pose, target, 2.0, this.obstacles(input));
            if (navPoint.command) return navPoint.command;
            return nav.search(input.agent.runtime.searchStep++);
        }

        const obstacles = this.obstacles(input);
        const predictedBall = this.predictBall(input);
        const approach = nav.approachBall(predictedBall || input.ball, obstacles);
        if (approach.done) {
            return { n: 'turn', v: 0 };
        }

        // [NEW] Перехват пасов наперерез:
        // для быстро движущегося мяча идем в прогнозируемую глобальную точку.
        if (
            predictedBall
            && predictedBall.fast
            && predictedBall.global
            && this.hasReliablePose(input)
        ) {
            const intercept = nav.navigateToPoint(input.world.pose, predictedBall.global, 1.0, obstacles);
            if (intercept.command && intercept.command.n === 'turn') {
                return intercept.command;
            }
            if (input.ball.distance > 3) {
                return { n: 'dash', v: 100 };
            }
            if (intercept.command) {
                return intercept.command;
            }
        }

        // [NEW] Агрессивный режим: при дальнем мяче атакующий всегда ускоряется на максимум.
        if (input.ball.distance > 3) {
            if (
                predictedBall
                && typeof predictedBall.direction === 'number'
                && Math.abs(predictedBall.direction) > 16
            ) {
                return { n: 'turn', v: predictedBall.direction };
            }
            return { n: 'dash', v: 100 };
        }

        input.agent.runtime.searchStep = 0;
        return approach.command;
    }

    seekBall(input, nav) {
        if (input.ball) {
            const chase = nav.approachBall(input.ball, this.obstacles(input));
            if (chase.command) return chase.command;
            return { n: 'turn', v: 0 };
        }

        if (!this.hasReliablePose(input)) {
            return nav.search(input.agent.runtime.searchStep++);
        }

        const target = input.assignment.target || { x: 0, y: 0 };
        const navPoint = nav.navigateToPoint(input.world.pose, target, 2.2, this.obstacles(input));
        if (navPoint.command) {
            input.agent.runtime.searchStep = 0;
            return navPoint.command;
        }
        if (navPoint.done) {
            if ((input.agent.runtime.searchStep % 4) === 0) return { n: 'dash', v: 50 };
            return nav.search(input.agent.runtime.searchStep++);
        }
        return nav.search(input.agent.runtime.searchStep++);
    }

    guardGoal(input, nav) {
        if (!this.hasReliablePose(input)) {
            return nav.search(input.agent.runtime.searchStep++);
        }

        const ownGoalCenter = getPoint(input.agent.ownGoalName());
        const side = input.agent.side || 'l';
        const ballGlobal = input.ballGlobal || this.toGlobal(input, input.ball);

        // [NEW] Сокращение угла обстрела:
        // если мяч на своей половине, вратарь выходит из ворот по отрезку goal->ball.
        let goalieTarget = { x: ownGoalCenter.x, y: ownGoalCenter.y };
        if (ballGlobal) {
            const inOwnHalf = side === 'l' ? ballGlobal.x < -20 : ballGlobal.x > 20;
            if (inOwnHalf) {
                const vx = ballGlobal.x - ownGoalCenter.x;
                const vy = ballGlobal.y - ownGoalCenter.y;
                const len = Math.max(1e-6, Math.hypot(vx, vy));
                const step = clamp(6.0, 4.0, 8.0);
                goalieTarget = {
                    x: ownGoalCenter.x + (vx / len) * step,
                    y: ownGoalCenter.y + (vy / len) * step,
                };

                if (side === 'l') goalieTarget.x = clamp(goalieTarget.x, -48, -45);
                else goalieTarget.x = clamp(goalieTarget.x, 45, 48);
            } else {
                const shiftY = clamp(ballGlobal.y * 0.4, -6.5, 6.5);
                goalieTarget = { x: ownGoalCenter.x, y: ownGoalCenter.y + shiftY };
            }
        }

        const approach = nav.navigateToPoint(input.world.pose, goalieTarget, 1.2, this.obstacles(input));
        if (approach.command) {
            return approach.command;
        }

        // [NEW] Локальная доводка при близком мяче.
        if (input.ball && input.ball.distance < 2.0) {
            if (Math.abs(input.ball.direction) > 8) {
                return { n: 'turn', v: input.ball.direction };
            }
            return { n: 'dash', v: 60 };
        }

        if (input.ball && typeof input.ball.direction === 'number') {
            if (Math.abs(input.ball.direction) > 10) {
                return { n: 'turn', v: input.ball.direction };
            }
            return { n: 'dash', v: 35 };
        }

        if (!input.ownGoal) {
            return nav.search(input.agent.runtime.searchStep++);
        }
        if (Math.abs(input.ownGoal.direction) > 8) {
            return { n: 'turn', v: input.ownGoal.direction };
        }
        return { n: 'turn', v: 20 };
    }

    moveToPoint(input, point, reach) {
        const nav = input.agent.navigator;
        if (!this.hasReliablePose(input)) {
            return nav.search(input.agent.runtime.searchStep++);
        }
        const result = nav.navigateToPoint(input.world.pose, point, reach, this.obstacles(input));
        if (result.command) {
            input.agent.runtime.searchStep = 0;
            return result.command;
        }
        if (result.done) {
            return { n: 'turn', v: 20 };
        }
        return nav.search(input.agent.runtime.searchStep++);
    }
}

module.exports = MiddleController;
