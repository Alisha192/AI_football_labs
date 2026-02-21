'use strict';

const BaseAgent = require('../lab2/lib/base_agent');
const Navigator = require('../lab2/lib/navigator');
const ObjectFilter = require('../lab2/lib/object_filter');

class CoordinatedAgent extends BaseAgent {
    constructor(options) {
        super(options);
        this.navigator = new Navigator();
        this.filter = new ObjectFilter();

        this.role = options.role || 'passer';
        this.filteredObjects = [];

        this.fsm = {
            state: 'wait_play_on',
            searchStep: 0,
            goSent: false,
            goReceivedTime: -1,
            goBoostUntil: -1,
        };
    }

    onInit() {
        this.log(`initialized coordinated role=${this.role}`);
    }

    onGoal() {
        this.fsm.state = 'wait_play_on';
        this.fsm.searchStep = 0;
        this.fsm.goSent = false;
        this.fsm.goReceivedTime = -1;
        this.fsm.goBoostUntil = -1;
        this.moveToStart();
    }

    onHear(hear) {
        if (hear.sender !== 'referee' && hear.message === 'go') {
            this.fsm.goReceivedTime = hear.time;
            this.fsm.goBoostUntil = hear.time + 20;
        }
    }

    onSee(world) {
        this.filteredObjects = this.filter.update(world.objects);
    }

    mirrorName(name) {
        if (!name || this.side !== 'r') return name;
        const parts = name.split(' ');
        for (let i = 0; i < parts.length; i += 1) {
            if (parts[i] === 'l') parts[i] = 'r';
            else if (parts[i] === 'r') parts[i] = 'l';
        }
        return parts.join(' ');
    }

    visible(name) {
        let best = null;
        for (const obj of this.filteredObjects) {
            if (obj.name !== name) continue;
            if (obj.distance === null) continue;
            if (!best || obj.distance < best.distance) best = obj;
        }
        return best;
    }

    gotoVisibleFlag(flagName, reach = 3) {
        const target = this.visible(this.mirrorName(flagName));
        if (!target) {
            this.fsm.searchStep += 1;
            return { done: false, command: this.navigator.search(this.fsm.searchStep) };
        }

        const nav = this.navigator.navigateToVisible(target, reach);
        if (nav.done) {
            this.fsm.searchStep = 0;
            return { done: true, command: { n: 'turn', v: 0 } };
        }

        this.fsm.searchStep = 0;
        return { done: false, command: nav.command };
    }

    decide(world) {
        if (!this.run) return null;
        return this.role === 'passer' ? this.decidePasser(world) : this.decideStriker(world);
    }

    decidePasser() {
        if (this.fsm.state === 'wait_play_on') {
            this.fsm.state = 'move_to_pass_flag';
        }

        if (this.fsm.state === 'move_to_pass_flag') {
            const move = this.gotoVisibleFlag('f p l c', 2.5);
            if (move.done) {
                this.fsm.state = 'seek_ball';
            }
            return move.command;
        }

        if (this.fsm.state === 'announce_pass') {
            this.fsm.state = 'kick_pass';
            this.fsm.goSent = true;
            return { n: 'say', v: 'go' };
        }

        if (this.fsm.state === 'kick_pass') {
            const ball = this.visible('b');
            if (!ball) {
                this.fsm.state = 'seek_ball';
                return this.navigator.search(this.fsm.searchStep++);
            }
            if (ball.distance > 0.9) {
                const nav = this.navigator.approachBall(ball);
                return nav.command || this.navigator.search(this.fsm.searchStep++);
            }

            const teammate = this.bestPassTarget();
            this.fsm.state = 'after_pass';
            if (teammate) {
                return { n: 'kick', v: [35, teammate.direction] };
            }

            const fallback = this.visible(this.opponentGoalName());
            return { n: 'kick', v: [30, fallback ? fallback.direction : 10] };
        }

        if (this.fsm.state === 'seek_ball') {
            const ball = this.visible('b');
            if (!ball) {
                this.fsm.searchStep += 1;
                return this.navigator.search(this.fsm.searchStep);
            }

            const approach = this.navigator.approachBall(ball);
            if (!approach.done) {
                return approach.command;
            }

            this.fsm.state = this.fsm.goSent ? 'kick_pass' : 'announce_pass';
            return { n: 'turn', v: 0 };
        }

        if (this.fsm.state === 'after_pass') {
            const back = this.gotoVisibleFlag('f p l c', 2.5);
            if (back.done) {
                this.fsm.state = 'seek_ball';
                this.fsm.goSent = false;
            }
            return back.command;
        }

        this.fsm.state = 'seek_ball';
        return { n: 'turn', v: 20 };
    }

    bestPassTarget() {
        let best = null;
        for (const obj of this.filteredObjects) {
            if (obj.kind !== 'player') continue;
            if (obj.team && obj.team !== this.teamName) continue;
            if (obj.unum && this.unum && obj.unum === this.unum) continue;
            if (obj.distance === null || obj.direction === null) continue;
            if (obj.distance < 0.8) continue;
            if (!best || obj.distance > best.distance) best = obj;
        }
        return best;
    }

    decideStriker(world) {
        if (this.fsm.state === 'wait_play_on') {
            this.fsm.state = 'move_lane_1';
        }

        if (this.fsm.state === 'move_lane_1') {
            const lane = this.gotoVisibleFlag('f p l b', 3.0);
            if (lane.done) {
                this.fsm.state = 'move_lane_2';
            }
            return lane.command;
        }

        if (this.fsm.state === 'move_lane_2') {
            const lane = this.gotoVisibleFlag('f g r b', 3.0);
            if (lane.done) {
                this.fsm.state = 'wait_pass';
            }
            return lane.command;
        }

        if (this.fsm.state === 'wait_pass') {
            const ball = this.visible('b');
            if (ball) {
                this.fsm.state = 'attack_ball';
                return { n: 'turn', v: 0 };
            }

            if (this.fsm.goReceivedTime >= 0 && world.time - this.fsm.goReceivedTime < 20) {
                this.fsm.state = 'attack_ball';
                return { n: 'dash', v: 70 };
            }

            if (this.fsm.goBoostUntil >= 0 && world.time <= this.fsm.goBoostUntil) {
                return { n: 'dash', v: 75 };
            }

            return { n: 'turn', v: 20 };
        }

        if (this.fsm.state === 'attack_ball') {
            const ball = this.visible('b');
            if (!ball) {
                return { n: 'dash', v: 80 };
            }

            const approach = this.navigator.approachBall(ball);
            if (!approach.done) {
                return approach.command;
            }

            const goal = this.visible(this.opponentGoalName());
            if (goal) {
                if (Math.abs(goal.direction) > 12) {
                    return { n: 'turn', v: goal.direction };
                }
                return { n: 'kick', v: [100, goal.direction] };
            }

            return { n: 'kick', v: [40, 45] };
        }

        this.fsm.state = 'wait_pass';
        return { n: 'turn', v: 20 };
    }
}

module.exports = CoordinatedAgent;
