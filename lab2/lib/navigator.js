'use strict';

const { clamp, normalizeAngle, rad2deg } = require('./math');

class Navigator {
    constructor() {
        this.angleThreshold = 8;
        this.reachDistance = 2.5;
        this.ballKickDistance = 0.7;
    }

    search(step) {
        const phase = step % 8;
        if (phase === 4) return { n: 'dash', v: 55 };
        if (phase === 7) return { n: 'turn', v: -120 };
        return { n: 'turn', v: 35 };
    }

    turnTo(angle) {
        return { n: 'turn', v: clamp(angle, -90, 90) };
    }

    dashTo(distance, maxPower = 100) {
        let power = 25 + distance * 14;
        if (distance < 5) power *= 0.6;
        return { n: 'dash', v: Math.round(clamp(power, 20, maxPower)) };
    }

    navigateToVisible(target, reachDistance = this.reachDistance) {
        if (!target || typeof target.distance !== 'number' || typeof target.direction !== 'number') {
            return { done: false, command: null };
        }
        if (target.distance <= reachDistance) {
            return { done: true, command: null };
        }
        if (Math.abs(target.direction) > this.angleThreshold) {
            return { done: false, command: this.turnTo(target.direction) };
        }
        return { done: false, command: this.dashTo(target.distance) };
    }

    navigateToPoint(pose, point, reachDistance = this.reachDistance) {
        if (!pose || !point) {
            return { done: false, command: null };
        }

        const dx = point.x - pose.x;
        const dy = point.y - pose.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= reachDistance) {
            return { done: true, command: null };
        }

        const targetHeading = rad2deg(Math.atan2(dy, dx));
        const delta = normalizeAngle(targetHeading - pose.bodyDir);
        if (Math.abs(delta) > this.angleThreshold) {
            return { done: false, command: this.turnTo(delta) };
        }

        return { done: false, command: this.dashTo(dist) };
    }

    approachBall(ball) {
        return this.navigateToVisible(ball, this.ballKickDistance);
    }

    kickTo(goal, strong = false) {
        if (goal && typeof goal.direction === 'number') {
            const power = strong ? 100 : 70;
            return { n: 'kick', v: [power, goal.direction] };
        }
        return { n: 'kick', v: [30, 45] };
    }
}

module.exports = Navigator;
