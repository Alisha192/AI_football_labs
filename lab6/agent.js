'use strict';

const BaseAgent = require('../lab2/lib/base_agent');
const Navigator = require('../lab2/lib/navigator');
const ObjectFilter = require('../lab2/lib/object_filter');
const { globalObjectPosition } = require('../lab2/lib/localization');
const { getPoint } = require('../lab2/lib/flags');
const { normalizeAngle, rad2deg } = require('../lab2/lib/math');
const Hierarchy = require('./hierarchy');
const LowController = require('./controllers/low');
const MiddleController = require('./controllers/middle');
const HighController = require('./controllers/high');

class TeamGameAgent extends BaseAgent {
    constructor(options) {
        super(options);
        this.agentId = options.agentId;
        this.role = options.role;
        this.coordinator = options.coordinator;
        this.layout = options.layout;

        this.navigator = new Navigator();
        this.filter = new ObjectFilter();
        this.filtered = [];

        this.runtime = {
            searchStep: 0,
            goSignalTime: -1,
            sayCooldown: 0,
        };

        this.pendingSay = null;
        this.hierarchy = new Hierarchy([
            new LowController(),
            new MiddleController(),
            new HighController(),
        ]);
    }

    onInit() {
        const info = this.layout[this.agentId];
        if (this.side === 'r' && info && !info.mirrored) {
            info.home = { x: -info.home.x, y: info.home.y };
            info.mirrored = true;
        }

        if (info) {
            info.side = this.side;
        }

        this.log(`initialized hierarchical role=${this.role}`);
    }

    onHear(hear) {
        if (hear.sender !== 'referee' && hear.message === 'go') {
            this.runtime.goSignalTime = hear.time;
        }
    }

    onGoal() {
        this.runtime.searchStep = 0;
        this.runtime.goSignalTime = -1;
        this.pendingSay = null;
    }

    onSee(world) {
        this.filtered = this.filter.update(world.objects);

        const ball = this.visible('b');
        const poseReliable = !!(world.pose && world.pose.reliable !== false);
        const ballGlobal = poseReliable && ball ? globalObjectPosition(world.pose, ball) : null;

        this.coordinator.updateReport(this.agentId, {
            time: world.time,
            pose: world.pose,
            poseReliable,
            poseAge: world.pose ? (world.pose.lostTicks || 0) : Number.POSITIVE_INFINITY,
            ballGlobal,
            ballDistance: ball ? ball.distance : null,
            role: this.role,
        });

        if (this.runtime.sayCooldown > 0) {
            this.runtime.sayCooldown -= 1;
        }

        if (this.debug && this.agentId === 5 && world.time % 50 === 0) {
            this.log(
                `t=${world.time} flags=${world.flags.length} ball=${ball ? `${ball.distance.toFixed(2)}@${ball.direction.toFixed(1)}` : 'none'} pose=${world.pose ? `${world.pose.x.toFixed(1)},${world.pose.y.toFixed(1)}${world.pose.reliable === false ? '!' : ''}` : 'none'}`
            );
        }
    }

    visible(name) {
        let nearest = null;
        for (const obj of this.filtered) {
            if (obj.name !== name) continue;
            if (obj.distance === null) continue;
            if (!nearest || obj.distance < nearest.distance) {
                nearest = obj;
            }
        }
        return nearest;
    }

    nearestOpponent() {
        let nearest = null;
        for (const obj of this.filtered) {
            if (obj.kind !== 'player') continue;
            if (!obj.team || obj.team === this.teamName) continue;
            if (obj.distance === null) continue;
            if (!nearest || obj.distance < nearest.distance) {
                nearest = obj;
            }
        }
        return nearest;
    }

    nearestTeammate() {
        let nearest = null;
        for (const obj of this.filtered) {
            if (obj.kind !== 'player') continue;
            if (obj.team && obj.team !== this.teamName) continue;
            if (obj.distance === null) continue;
            if (!nearest || obj.distance < nearest.distance) {
                nearest = obj;
            }
        }
        return nearest;
    }

    relativeAngleToPoint(point) {
        if (!point || !this.world.pose || this.world.pose.reliable === false) return null;
        const dx = point.x - this.world.pose.x;
        const dy = point.y - this.world.pose.y;
        const global = rad2deg(Math.atan2(dy, dx));
        return normalizeAngle(global - this.world.pose.bodyDir);
    }

    distanceToPoint(point) {
        if (!point || !this.world.pose || this.world.pose.reliable === false) return null;
        return Math.hypot(point.x - this.world.pose.x, point.y - this.world.pose.y);
    }

    opponentGoalPoint() {
        return getPoint(this.opponentGoalName());
    }

    decide(world) {
        if (!this.run) return null;

        const localBall = this.visible('b');
        if (this.pendingSay && this.runtime.sayCooldown <= 0 && (!localBall || localBall.distance > 0.9)) {
            const msg = this.pendingSay;
            this.pendingSay = null;
            this.runtime.sayCooldown = 6;
            this.queueSay(msg);
        }

        const assignment = this.coordinator.getAssignment(this.agentId);
        const opponentGoalPoint = this.opponentGoalPoint();
        const input = {
            agent: this,
            world,
            filtered: this.filtered,
            role: this.role,
            assignment,
            ball: localBall,
            ownGoal: this.visible(this.ownGoalName()),
            goalOpp: this.visible(this.opponentGoalName()),
            nearestOpponent: this.nearestOpponent(),
            nearestMate: this.nearestTeammate(),
            opponentGoalPoint,
            opponentGoalAngleGlobal: this.relativeAngleToPoint(opponentGoalPoint),
            opponentGoalDistanceGlobal: this.distanceToPoint(opponentGoalPoint),
            heardGo: this.runtime.goSignalTime >= 0 && world.time - this.runtime.goSignalTime < 20,
            command: null,
        };

        const command = this.hierarchy.execute(input);
        if (command && command.n === 'say') {
            this.queueAuxCommand(command);
            return { n: 'turn', v: 0 };
        }
        return command || { n: 'turn', v: 20 };
    }
}

module.exports = TeamGameAgent;
