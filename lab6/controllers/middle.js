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

    attackBall(input, nav) {
        if (!input.ball) {
            const target = input.assignment.target || { x: 0, y: 0 };
            const navPoint = nav.navigateToPoint(input.world.pose, target, 2.0);
            if (navPoint.command) return navPoint.command;
            return nav.search(input.agent.runtime.searchStep++);
        }

        const approach = nav.approachBall(input.ball);
        if (approach.done) {
            return { n: 'turn', v: 0 };
        }

        input.agent.runtime.searchStep = 0;
        return approach.command;
    }

    seekBall(input, nav) {
        if (input.ball) {
            const chase = nav.approachBall(input.ball);
            if (chase.command) return chase.command;
            return { n: 'turn', v: 0 };
        }

        const target = input.assignment.target || { x: 0, y: 0 };
        const navPoint = nav.navigateToPoint(input.world.pose, target, 2.2);
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
        if (!input.ownGoal) {
            return nav.search(input.agent.runtime.searchStep++);
        }
        if (Math.abs(input.ownGoal.direction) > 8) {
            return { n: 'turn', v: input.ownGoal.direction };
        }
        if (input.ownGoal.distance > 1.8) {
            return { n: 'dash', v: 55 };
        }
        return { n: 'turn', v: 20 };
    }

    moveToPoint(input, point, reach) {
        const nav = input.agent.navigator;
        const result = nav.navigateToPoint(input.world.pose, point, reach);
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
