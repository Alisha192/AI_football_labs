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

    // Базовый профиль ускорения:
    // чем дальше цель, тем выше мощность; на малой дистанции оставляем
    // достаточный минимум, чтобы не "залипать" на подбеге.
    // obstacleFactor в [0.55..1.0] снижает рывок, если впереди плотное препятствие.
    dashTo(distance, maxPower = 100, obstacleFactor = 1) {
        let power = 25 + distance * 14;
        if (distance < 5) power = Math.max(45, power * 0.8);
        power *= clamp(obstacleFactor, 0.55, 1.0);
        return { n: 'dash', v: Math.round(clamp(power, 20, maxPower)) };
    }

    // Простейшая модель "отталкивания":
    // если игрок-препятствие находится почти на линии движения (малый угол к targetAngle)
    // и близко (до 2 м), поворачиваем в сторону, противоположную obstacle.
    avoidByObstacles(targetAngle, obstacles = []) {
        let blocker = null;
        for (const obj of obstacles) {
            if (!obj || obj.kind !== 'player') continue;
            if (typeof obj.distance !== 'number' || typeof obj.direction !== 'number') continue;
            if (obj.distance > 2.0) continue;

            const rel = normalizeAngle(obj.direction - targetAngle);
            if (Math.abs(rel) > 18) continue;

            if (!blocker || obj.distance < blocker.distance) {
                blocker = { distance: obj.distance, rel };
            }
        }

        if (!blocker) {
            return {
                angle: targetAngle,
                obstacleFactor: 1,
                avoided: false,
            };
        }

        const sideBias = blocker.rel >= 0 ? -35 : 35;
        const angle = normalizeAngle(targetAngle + sideBias);
        const obstacleFactor = blocker.distance < 1.2 ? 0.65 : 0.8;
        return { angle, obstacleFactor, avoided: true };
    }

    // Навигация на видимый объект с обходом препятствий:
    // 1) берем угол на цель
    // 2) корректируем его, если впереди игрок
    // 3) сначала доворачиваемся, затем даем dash.
    navigateToVisible(target, reachDistance = this.reachDistance, obstacles = []) {
        if (!target || typeof target.distance !== 'number' || typeof target.direction !== 'number') {
            return { done: false, command: null };
        }
        if (target.distance <= reachDistance) {
            return { done: true, command: null };
        }

        const avoided = this.avoidByObstacles(target.direction, obstacles);
        let currentThreshold = this.angleThreshold;
        if (target.distance < 1.5) currentThreshold = 35;
        if (avoided.avoided) currentThreshold = Math.max(currentThreshold, 12);

        if (Math.abs(avoided.angle) > currentThreshold) {
            return { done: false, command: this.turnTo(avoided.angle) };
        }
        return { done: false, command: this.dashTo(target.distance, 100, avoided.obstacleFactor) };
    }

    // Навигация в глобальную точку с тем же обходом препятствий:
    // targetHeading -> относительный угол delta -> корректировка delta.
    navigateToPoint(pose, point, reachDistance = this.reachDistance, obstacles = []) {
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
        const avoided = this.avoidByObstacles(delta, obstacles);
        if (Math.abs(avoided.angle) > this.angleThreshold) {
            return { done: false, command: this.turnTo(avoided.angle) };
        }

        return { done: false, command: this.dashTo(dist, 100, avoided.obstacleFactor) };
    }

    approachBall(ball, obstacles = []) {
        return this.navigateToVisible(ball, this.ballKickDistance, obstacles);
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
