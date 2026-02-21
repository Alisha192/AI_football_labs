'use strict';

const BaseAgent = require('../lab2/lib/base_agent');
const Navigator = require('../lab2/lib/navigator');
const ObjectFilter = require('../lab2/lib/object_filter');
const { globalObjectPosition } = require('../lab2/lib/localization');

class MultiPlayerAgent extends BaseAgent {
    constructor(options) {
        super(options);
        this.agentId = options.agentId;
        this.coordinator = options.coordinator;
        this.layout = options.layout;

        this.navigator = new Navigator();
        this.filter = new ObjectFilter();

        this.filteredObjects = [];
        this.fsm = {
            state: 'idle',
            searchStep: 0,
        };
    }

    onInit() {
        if (this.layout[this.agentId]) {
            this.layout[this.agentId].side = this.side;
        }
        this.log(`initialized role=${this.role}`);
    }

    onGoal() {
        this.fsm.state = 'idle';
        this.fsm.searchStep = 0;
    }

    onSee(world) {
        this.filteredObjects = this.filter.update(world.objects);

        const ball = this.visible('b');
        const ballGlobal = world.pose && ball ? globalObjectPosition(world.pose, ball) : null;

        this.coordinator.updateReport(this.agentId, {
            time: world.time,
            pose: world.pose,
            ballGlobal,
            ballDistance: ball ? ball.distance : null,
            role: this.role,
        });
    }

    visible(name) {
        let nearest = null;
        for (const obj of this.filteredObjects) {
            if (obj.name !== name) continue;
            if (obj.distance === null) continue;
            if (!nearest || obj.distance < nearest.distance) {
                nearest = obj;
            }
        }
        return nearest;
    }

    decide(world) {
        if (!this.run) return null;

        if (this.role === 'goalie') {
            return this.decideGoalie(world);
        }

        const assignment = this.coordinator.getAssignment(this.agentId);
        if (assignment.task === 'attack_ball') {
            return this.decideAttacker(world);
        }
        return this.decideSupport(world, assignment.target);
    }

    decideAttacker(world) {
        this.fsm.state = 'attack_ball';

        const ball = this.visible('b');
        if (!ball) {
            this.fsm.searchStep += 1;
            return this.navigator.search(this.fsm.searchStep);
        }

        const approach = this.navigator.approachBall(ball);
        if (!approach.done) {
            this.fsm.searchStep = 0;
            return approach.command;
        }

        const goal = this.visible(this.opponentGoalName());
        if (goal) {
            if (Math.abs(goal.direction) > 12) {
                return { n: 'turn', v: goal.direction };
            }
            return this.navigator.kickTo(goal, true);
        }

        const sideKick = this.agentId % 2 === 0 ? 30 : -30;
        return { n: 'kick', v: [25, sideKick] };
    }

    decideSupport(world, targetPoint) {
        this.fsm.state = 'support';

        const ball = this.visible('b');
        if (ball && ball.distance < 1.0) {
            const goal = this.visible(this.opponentGoalName());
            if (goal) {
                return this.navigator.kickTo(goal, false);
            }
            return { n: 'kick', v: [20, 30] };
        }

        const nav = this.navigator.navigateToPoint(world.pose, targetPoint, 2.0);
        if (nav.done) {
            return { n: 'turn', v: 20 };
        }
        if (nav.command) {
            this.fsm.searchStep = 0;
            return nav.command;
        }

        this.fsm.searchStep += 1;
        return this.navigator.search(this.fsm.searchStep);
    }

    decideGoalie(world) {
        const ball = this.visible('b');

        if (ball) {
            if (ball.distance < 1.0) {
                const goal = this.visible(this.opponentGoalName());
                if (goal) {
                    return this.navigator.kickTo(goal, true);
                }
                return { n: 'kick', v: [80, 0] };
            }

            if (ball.distance < 2.0 && Math.abs(ball.direction) < 25) {
                return { n: 'catch', v: ball.direction };
            }

            if (Math.abs(ball.direction) > 10) {
                return { n: 'turn', v: ball.direction };
            }
            return { n: 'dash', v: 80 };
        }

        const ownGoal = this.visible(this.ownGoalName());
        if (!ownGoal) {
            this.fsm.searchStep += 1;
            return this.navigator.search(this.fsm.searchStep);
        }

        if (Math.abs(ownGoal.direction) > 8) {
            return { n: 'turn', v: ownGoal.direction };
        }

        if (ownGoal.distance > 1.7) {
            return { n: 'dash', v: 50 };
        }

        return { n: 'turn', v: 30 };
    }
}

module.exports = MultiPlayerAgent;
