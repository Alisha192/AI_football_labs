'use strict';

const { clamp } = require('../lab2/lib/math');

class TeamCoordinator {
    constructor(layout) {
        this.layout = layout;
        this.reports = new Map();
        this.assignments = new Map();
        this.lastBall = null;
    }

    updateReport(agentId, report) {
        this.reports.set(agentId, report);
        this.recompute();
    }

    estimateBall() {
        const points = [];
        for (const report of this.reports.values()) {
            if (report.ballGlobal) points.push(report.ballGlobal);
        }
        if (points.length === 0) {
            return this.lastBall;
        }

        let x = 0;
        let y = 0;
        for (const p of points) {
            x += p.x;
            y += p.y;
        }
        this.lastBall = { x: x / points.length, y: y / points.length };
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

            if (report.pose) {
                fieldPlayers.push({ id, info, report });
            }
        }

        let attacker = null;
        let support = null;

        if (ball && fieldPlayers.length > 0) {
            const sorted = [...fieldPlayers].sort((a, b) => {
                const da = Math.hypot(a.report.pose.x - ball.x, a.report.pose.y - ball.y);
                const db = Math.hypot(b.report.pose.x - ball.x, b.report.pose.y - ball.y);
                if (da !== db) return da - db;
                return a.id - b.id;
            });

            attacker = sorted[0];
            support = sorted.length > 1 ? sorted[1] : null;
        }

        for (const player of fieldPlayers) {
            const assignment = this.assignmentFor(player, ball, attacker, support);
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

    assignmentFor(player, ball, attacker, support) {
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
            const target = this.supportTarget(ball, side);
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

    supportTarget(ball, side) {
        const offsetX = side === 'l' ? -8 : 8;
        return {
            x: clamp(ball.x + offsetX, -45, 45),
            y: clamp(ball.y + 6, -30, 30),
        };
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
