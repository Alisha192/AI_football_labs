'use strict';

const BaseAgent = require('../lab2/lib/base_agent');
const Navigator = require('../lab2/lib/navigator');
const ObjectFilter = require('../lab2/lib/object_filter');
const TimedAutomaton = require('./timed_automaton');
const { buildContext } = require('./percepts');
const createAttackerMachine = require('./machines/attacker_machine');
const createGoalieMachine = require('./machines/goalie_machine');

class AutomatonAgent extends BaseAgent {
    constructor(options) {
        super(options);
        this.role = options.role || 'attacker';
        this.navigator = new Navigator();
        this.filter = new ObjectFilter();

        this.filteredObjects = [];
        this.lastBall = null;

        const machineSpec = this.role === 'goalie'
            ? createGoalieMachine(this)
            : createAttackerMachine(this);
        this.machine = new TimedAutomaton(machineSpec);
    }

    onInit() {
        this.log(`initialized timed-automaton role=${this.role}`);
    }

    onGoal() {
        this.machine.reset();
    }

    onSee(world) {
        this.filteredObjects = this.filter.update(world.objects);
        const ball = this.visible('b');
        this.lastBall = ball ? { ...ball } : null;
    }

    visible(name) {
        let best = null;
        for (const obj of this.filteredObjects) {
            if (obj.name !== name) continue;
            if (obj.distance === null) continue;
            if (!best || obj.distance < best.distance) {
                best = obj;
            }
        }
        return best;
    }

    decide(world) {
        if (!this.run) return null;

        const ctx = buildContext(this, world, this.filteredObjects);
        return this.machine.tick(ctx);
    }
}

module.exports = AutomatonAgent;
