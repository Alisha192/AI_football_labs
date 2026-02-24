'use strict';

class TimedAutomaton {
    constructor(spec) {
        if (!spec || !spec.initial || !spec.states || !spec.states[spec.initial]) {
            throw new Error('Invalid timed automaton specification');
        }

        this.spec = spec;
        this.state = {
            current: spec.initial,
            lastTime: null,
            timers: { t: 0 },
            vars: { ...(spec.vars || {}) },
            local: {},
        };

        const node = this.currentNode();
        if (node.onEnter) node.onEnter(this.state);
    }

    currentNode() {
        return this.spec.states[this.state.current];
    }

    reset(initialState = this.spec.initial) {
        this.state.current = initialState;
        this.state.lastTime = null;
        this.state.timers = { t: 0 };
        this.state.local = {};
        this.state.vars = { ...(this.spec.vars || {}) };

        const node = this.currentNode();
        if (node.onEnter) node.onEnter(this.state);
    }

    tick(ctx) {
        this.advanceTime(ctx.time);

        const evalCtx = {
            ...ctx,
            state: this.state,
            t: this.state.timers.t,
        };

        this.applyTransitions(evalCtx);

        const node = this.currentNode();
        if (typeof node.action === 'function') {
            return node.action(evalCtx, this.state);
        }
        return null;
    }

    advanceTime(time) {
        if (typeof time !== 'number' || !Number.isFinite(time)) return;

        if (this.state.lastTime === null) {
            this.state.lastTime = time;
            return;
        }

        const dt = Math.max(0, time - this.state.lastTime);
        this.state.lastTime = time;

        for (const key of Object.keys(this.state.timers)) {
            this.state.timers[key] += dt;
        }
    }

    applyTransitions(ctx) {
        for (let safety = 0; safety < 8; safety += 1) {
            const node = this.currentNode();
            const edges = Array.isArray(node.transitions) ? node.transitions : [];
            let moved = false;

            for (const edge of edges) {
                if (typeof edge.guard === 'function' && !edge.guard(ctx, this.state)) {
                    continue;
                }

                if (Array.isArray(edge.reset)) {
                    for (const timerName of edge.reset) {
                        this.state.timers[timerName] = 0;
                    }
                }

                if (typeof edge.effect === 'function') {
                    edge.effect(ctx, this.state);
                }

                this.state.current = edge.to;
                if (!this.spec.states[this.state.current]) {
                    throw new Error(`Unknown state transition target: ${edge.to}`);
                }

                const entered = this.currentNode();
                if (entered.onEnter) {
                    entered.onEnter(this.state);
                }

                moved = true;
                break;
            }

            if (!moved) {
                return;
            }
        }
    }
}

module.exports = TimedAutomaton;
