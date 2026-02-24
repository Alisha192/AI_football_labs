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
            if (report.ballGlobal) {
                points.push(report.ballGlobal);
            }
        }

        if (points.length === 0) {
            return this.lastBall;
        }

        let sx = 0;
        let sy = 0;
        for (const p of points) {
            sx += p.x;
            sy += p.y;
        }
        this.lastBall = {
            x: sx / points.length,
            y: sy / points.length,
        };
        return this.lastBall;
    }

    recompute() {
        const ball = this.estimateBall();
        const players = [];

        for (const [id, report] of this.reports.entries()) {
            const info = this.layout[id];
            if (!info) continue;
            if (info.role !== 'goalie' && report.pose) {
                players.push({ id, report, info });
            }
        }

        let chaserId = null;
        if (ball && players.length > 0) {
            players.sort((a, b) => {
                const da = Math.hypot(a.report.pose.x - ball.x, a.report.pose.y - ball.y);
                const db = Math.hypot(b.report.pose.x - ball.x, b.report.pose.y - ball.y);
                if (da !== db) return da - db;
                return a.id - b.id;
            });
            chaserId = players[0].id;
        }

        for (const [id, info] of Object.entries(this.layout)) {
            const report = this.reports.get(Number(id));
            if (!report) continue;

            if (info.role === 'goalie') {
                this.assignments.set(Number(id), {
                    task: 'guard_goal',
                    target: info.home,
                });
                continue;
            }

            if (Number(id) === chaserId) {
                this.assignments.set(Number(id), {
                    task: 'attack_ball',
                    target: ball,
                });
                continue;
            }

            const supportPoint = this.supportPoint(info, ball);
            this.assignments.set(Number(id), {
                task: 'support',
                target: supportPoint,
            });
        }
    }

    supportPoint(info, ball) {
        if (!ball) return info.home;

        const sideSign = info.side === 'l' ? -1 : 1;
        const x = clamp(ball.x - sideSign * info.followDx, -50, 50);
        const y = clamp(ball.y + info.followDy, -30, 30);
        return { x, y };
    }

    getAssignment(agentId) {
        return this.assignments.get(agentId) || {
            task: 'support',
            target: this.layout[agentId] ? this.layout[agentId].home : { x: 0, y: 0 },
        };
    }
}

module.exports = TeamCoordinator;
