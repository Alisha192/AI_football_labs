'use strict';

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
                input.command = this.moveToPoint(input, assignment.target, 2.5);
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

    predictBall(ball) {
        if (!ball) return null;
        const predicted = { ...ball };
        if (typeof ball.dirChange === 'number') {
            predicted.direction = ball.direction + ball.dirChange * 2.0;
        }
        if (typeof ball.distChange === 'number') {
            predicted.distance = Math.max(0.1, ball.distance + ball.distChange * 2.0);
        }
        return predicted;
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
        const predictedBall = this.predictBall(input.ball);
        const approach = nav.approachBall(predictedBall || input.ball, obstacles);
        if (approach.done) {
            return { n: 'turn', v: 0 };
        }

        // Агрессивный режим перехвата:
        // если мяч далеко, не экономим — ускоряемся максимумом.
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

        const anchor = input.assignment && input.assignment.target
            ? input.assignment.target
            : { x: input.world.pose.x, y: input.world.pose.y };
        const goalX = anchor.x;
        const goalY = anchor.y;

        let shiftY = 0;
        if (input.ball && typeof input.ball.direction === 'number') {
            // Чем сильнее боковой угол на мяч, тем сильнее смещение по линии ворот.
            // Это приближенно удерживает вратаря на биссектрисе между мячом и центром ворот.
            shiftY = Math.max(-6.5, Math.min(6.5, (input.ball.direction / 45) * 5.5));
        }

        const goalieTarget = {
            x: goalX,
            y: goalY + shiftY,
        };
        const approach = nav.navigateToPoint(input.world.pose, goalieTarget, 1.2, this.obstacles(input));
        if (approach.command) {
            return approach.command;
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
