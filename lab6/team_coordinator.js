'use strict';

const { clamp } = require('../lab2/lib/math');

class TeamCoordinator {
    constructor(layout) {
        this.layout = layout;
        this.reports = new Map();
        this.assignments = new Map();
        this.lastBall = null;
        this.maxBallPoseAge = 3;
        this.maxBallStaleness = 20;
    }

    updateReport(agentId, report) {
        this.reports.set(agentId, { ...report, agentId });
        this.recompute();
    }

    latestReportTime() {
        let time = null;
        for (const report of this.reports.values()) {
            if (typeof report.time !== 'number' || !Number.isFinite(report.time)) continue;
            if (time === null || report.time > time) time = report.time;
        }
        return time;
    }

    estimateBall() {
        const candidates = [];
        for (const report of this.reports.values()) {
            if (!report.ballGlobal) continue;
            if (report.poseReliable !== true) continue;
            if (typeof report.ballDistance !== 'number' || !Number.isFinite(report.ballDistance)) continue;

            const poseAge = typeof report.poseAge === 'number' && Number.isFinite(report.poseAge)
                ? report.poseAge
                : Number.POSITIVE_INFINITY;
            if (poseAge > this.maxBallPoseAge) continue;

            candidates.push({
                point: report.ballGlobal,
                ballDistance: report.ballDistance,
                poseAge,
                time: typeof report.time === 'number' ? report.time : -Infinity,
                agentId: report.agentId,
            });
        }

        if (candidates.length === 0) {
            const now = this.latestReportTime();
            if (
                this.lastBall
                && typeof this.lastBall.time === 'number'
                && now !== null
                && now - this.lastBall.time > this.maxBallStaleness
            ) {
                this.lastBall = null;
            }
            return this.lastBall;
        }

        candidates.sort((a, b) => {
            if (a.ballDistance !== b.ballDistance) return a.ballDistance - b.ballDistance;
            if (a.poseAge !== b.poseAge) return a.poseAge - b.poseAge;
            if (a.time !== b.time) return b.time - a.time;
            return a.agentId - b.agentId;
        });

        const best = candidates[0];
        this.lastBall = {
            x: best.point.x,
            y: best.point.y,
            time: best.time,
            source: best.agentId,
        };
        return this.lastBall;
    }

    recompute() {
        const ball = this.estimateBall();

        const fieldPlayers = [];
        let goalieId = null;

        for (const [idStr, info] of Object.entries(this.layout)) {
            const id = Number(idStr);
            const report = this.reports.get(id);
            if (!report) continue;

            if (info.role === 'goalie') {
                goalieId = id;
                continue;
            }

            if (report.pose && report.poseReliable === true) {
                fieldPlayers.push({ id, info, report });
            }
        }

        let attacker = null;
        let support = null;

        if (ball && fieldPlayers.length > 0) {
            // [NEW] Time-to-Intercept эвристика:
            // cost = расстояние + штраф за разворот к мячу.
            // Это лучше, чем чистая дистанция, потому что учитывает инерцию направления игрока.
            const sorted = [...fieldPlayers].sort((a, b) => {
                const ca = this.interceptCost(a.report.pose, ball);
                const cb = this.interceptCost(b.report.pose, ball);
                if (ca !== cb) return ca - cb;
                return a.id - b.id;
            });

            attacker = sorted[0];
            support = sorted.length > 1 ? sorted[1] : null;
        }

        for (const player of fieldPlayers) {
            const assignment = this.assignmentFor(player, ball, attacker, support, fieldPlayers);
            this.assignments.set(player.id, assignment);
        }

        if (goalieId !== null) {
            const info = this.layout[goalieId];
            this.assignments.set(goalieId, {
                task: 'guard_goal',
                target: info.home,
            });
        }
    }

    // [NEW] Стоимость перехвата с учетом поворота корпуса.
    interceptCost(pose, ball) {
        const dx = ball.x - pose.x;
        const dy = ball.y - pose.y;
        const distance = Math.hypot(dx, dy);
        const toBall = Math.atan2(dy, dx) * 180 / Math.PI;
        const angleDiff = this.angleDelta(toBall, pose.bodyDir);
        return distance + (Math.abs(angleDiff) / 180) * 5.0;
    }

    // [NEW] Нормализованная разница углов в диапазоне [-180, 180].
    angleDelta(target, current) {
        let diff = target - current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return diff;
    }

    assignmentFor(player, ball, attacker, support, fieldPlayers = []) {
        const info = player.info;
        const side = info.side || 'l';

        if (!ball) {
            if (info.role === 'forward') {
                return { task: 'seek_ball', target: { x: 0, y: 0 } };
            }
            if (info.role === 'midfielder') {
                return { task: 'seek_ball', target: { x: side === 'l' ? -5 : 5, y: 0 } };
            }
            return { task: 'hold_zone', target: info.home };
        }

        if (attacker && attacker.id === player.id) {
            return {
                task: 'attack_ball',
                target: ball,
                receiverId: support ? support.id : null,
            };
        }

        if (support && support.id === player.id) {
            const target = this.supportTarget(ball, side, fieldPlayers, attacker);
            return {
                task: 'support_attack',
                target,
            };
        }

        const ownHalf = side === 'l' ? ball.x < 0 : ball.x > 0;
        if (ownHalf) {
            const defensiveTarget = {
                x: clamp((info.home.x + ball.x) / 2, -45, 45),
                y: clamp((info.home.y + ball.y) / 2, -30, 30),
            };
            return {
                task: 'defend_lane',
                target: defensiveTarget,
            };
        }

        return {
            task: 'hold_zone',
            target: info.home,
        };
    }

    supportTarget(ball, side, fieldPlayers = [], attacker = null) {
        const attackDir = side === 'l' ? 1 : -1;

        // Игрок поддержки должен быть немного позади атаки,
        // чтобы сохранить опцию паса назад и подбора мяча.
        const targetX = clamp(ball.x - attackDir * 6, -45, 45);

        const optionTop = clamp(ball.y + 10, -30, 30);
        const optionBottom = clamp(ball.y - 10, -30, 30);

        const laneCost = (candidateY) => {
            let cost = 0;
            for (const fp of fieldPlayers) {
                if (!fp || !fp.report || !fp.report.pose) continue;
                const p = fp.report.pose;

                // Штраф за занятый коридор рядом с целевой точкой поддержки.
                const dx = Math.abs(p.x - targetX);
                const dy = Math.abs(p.y - candidateY);
                if (dx < 12 && dy < 9) {
                    cost += (12 - dx) * 0.35 + (9 - dy) * 0.65;
                }
            }

            if (attacker && attacker.report && attacker.report.pose) {
                const ay = attacker.report.pose.y;
                // Дополнительный штраф, если поддержка слишком близко к оси атакующего.
                cost += Math.max(0, 8 - Math.abs(candidateY - ay)) * 0.8;
            }

            return cost;
        };

        const topCost = laneCost(optionTop);
        const bottomCost = laneCost(optionBottom);
        const targetY = topCost <= bottomCost ? optionTop : optionBottom;

        return { x: targetX, y: targetY };
    }

    getAssignment(agentId) {
        const assignment = this.assignments.get(agentId);
        if (assignment) return assignment;

        const info = this.layout[agentId];
        return {
            task: info && info.role === 'goalie' ? 'guard_goal' : 'hold_zone',
            target: info ? info.home : { x: 0, y: 0 },
        };
    }
}

module.exports = TeamCoordinator;
