'use strict';

const BaseAgent = require('./lib/base_agent');
const Navigator = require('./lib/navigator');
const ObjectFilter = require('./lib/object_filter');

class RouteAgent extends BaseAgent {
    constructor(options) {
        super(options);
        this.navigator = new Navigator();
        this.filter = new ObjectFilter();

        this.routeTemplate = (options.sequence || [
            { act: 'flag', f1: 'f r b', reach: 3.0 },
            { act: 'flag', f1: 'g l', reach: 3.0 },
            { act: 'kick', f1: 'b', goal: 'g r' },
        ]).map((step) => ({
            ...step,
            target: step.target || step.f1 || null,
            f1: step.f1 || step.target || null,
            reach: typeof step.reach === 'number' ? step.reach : 3.0,
        }));
        this.sequence = this.routeTemplate.map((step) => ({ ...step }));

        this.goals = 0;

        // Флаг, указывающий, началась ли игра
        this.gameStarted = false;

        this.state = {
            index: 0,
            searchStep: 0,
            lastLoggedTime: -1,
        };

        this.filteredObjects = [];
    }

    onInit() {
        this.sequence = this.prepareSequenceBySide();
        this.log('initialized route controller, waiting for play_on...');
    }

    onHear(message) {
        // Проверяем, является ли сообщение командой рефери
        if (message.sender === 'referee') {
            this.log(`referee said: ${message.message}`);

            // Если получена команда play_on, начинаем игру
            if (message.message === 'play_on') {
                this.gameStarted = true;
                this.log('game started!');
            }
        }
    }

    onGoal(message) {
        this.goals += 1;
        this.state.index = 0;
        this.state.searchStep = 0;
        this.sequence = this.prepareSequenceBySide();
        this.moveToStart();
        // После гола игра останавливается, ждем следующего play_on
        this.gameStarted = false;
        this.log(`goal event: ${message}, restart route (goals=${this.goals})`);
    }

    onSee(world) {
        this.filteredObjects = this.filter.update(world.objects);
        if (world.pose && world.time % 20 === 0 && this.state.lastLoggedTime !== world.time) {
            this.state.lastLoggedTime = world.time;
            this.log(
                `pose x=${world.pose.x.toFixed(2)} y=${world.pose.y.toFixed(2)} dir=${world.pose.bodyDir.toFixed(1)} err=${world.pose.error.toFixed(3)}`
            );
        }
    }

    currentAction() {
        return this.sequence[this.state.index];
    }

    advanceAction() {
        this.state.index = (this.state.index + 1) % this.sequence.length;
        this.state.searchStep = 0;
    }

    visibleByName(name) {
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

    prepareSequenceBySide() {
        const base = this.routeTemplate;
        if (this.side !== 'r') {
            return base.map((step) => ({ ...step, target: step.f1 || step.target }));
        }
        return base.map((step) => ({
            ...step,
            f1: this.mirrorName(step.f1 || step.target),
            target: this.mirrorName(step.target || step.f1),
            goal: this.mirrorName(step.goal),
        }));
    }

    mirrorName(name) {
        if (!name || typeof name !== 'string') return name;
        const parts = name.split(' ');
        for (let i = 0; i < parts.length; i += 1) {
            if (parts[i] === 'l') parts[i] = 'r';
            else if (parts[i] === 'r') parts[i] = 'l';
        }
        return parts.join(' ');
    }

    decide(world) {
        // Если игра не началась, не выполняем никаких действий
        if (!this.gameStarted) {
            return null;
        }

        if (!this.run) return null;

        const action = this.currentAction();
        if (!action) return { n: 'turn', v: 0 };

        if (action.act === 'flag') {
            return this.executeFlagAction(action);
        }

        if (action.act === 'kick') {
            return this.executeKickAction(action);
        }

        if (action.act === 'point') {
            return this.executePointAction(world, action);
        }

        return { n: 'turn', v: 20 };
    }

    executeFlagAction(action) {
        const targetName = action.f1 || action.target;
        const target = this.visibleByName(targetName);
        if (!target) {
            const cmd = this.navigator.search(this.state.searchStep);
            this.state.searchStep += 1;
            return cmd;
        }

        const nav = this.navigator.navigateToVisible(target, action.reach || 3.0);
        if (nav.done) {
            this.advanceAction();
            return { n: 'turn', v: 0 };
        }

        this.state.searchStep = 0;
        return nav.command;
    }

    executePointAction(world, action) {
        if (!action.point) return { n: 'turn', v: 20 };
        const nav = this.navigator.navigateToPoint(world.pose, action.point, action.reach || 2.5);
        if (!nav.command && !nav.done) {
            const cmd = this.navigator.search(this.state.searchStep);
            this.state.searchStep += 1;
            return cmd;
        }
        if (nav.done) {
            this.advanceAction();
            return { n: 'turn', v: 0 };
        }
        this.state.searchStep = 0;
        return nav.command;
    }

    executeKickAction(action) {
        const ballName = action.f1 || action.target || 'b';
        const ball = this.visibleByName(ballName);
        if (!ball) {
            const cmd = this.navigator.search(this.state.searchStep);
            this.state.searchStep += 1;
            return cmd;
        }

        const approach = this.navigator.approachBall(ball);
        if (!approach.done) {
            if (approach.command) {
                this.state.searchStep = 0;
                return approach.command;
            }
            const cmd = this.navigator.search(this.state.searchStep);
            this.state.searchStep += 1;
            return cmd;
        }

        const goalName = action.goal || this.opponentGoalName();
        const goal = this.visibleByName(goalName);

        if (!goal) {
            return { n: 'turn', v: 45 };
        }

        return this.navigator.kickTo(goal, goal.distance > 20);
    }
}

module.exports = RouteAgent;