'use strict';

function createAttackerMachine(agent) {
    const nav = agent.navigator;

    return {
        initial: 'search_ball',
        vars: {
            kicks: 0,
        },
        states: {
            search_ball: {
                action(ctx) {
                    return nav.search(Math.floor(ctx.t));
                },
                transitions: [
                    {
                        to: 'run_to_ball',
                        guard: (ctx) => !!ctx.ball,
                        reset: ['t'],
                    },
                ],
            },
            run_to_ball: {
                action(ctx) {
                    if (!ctx.ball) return nav.search(Math.floor(ctx.t));
                    const approach = nav.approachBall(ctx.ball);
                    return approach.command || { n: 'turn', v: 0 };
                },
                transitions: [
                    {
                        to: 'search_ball',
                        guard: (ctx) => !ctx.ball && ctx.t > 8,
                        reset: ['t'],
                    },
                    {
                        to: 'align_shot',
                        guard: (ctx) => ctx.ball && ctx.ball.distance <= 0.8,
                        reset: ['t'],
                    },
                ],
            },
            align_shot: {
                action(ctx) {
                    if (!ctx.ball || ctx.ball.distance > 1.0) {
                        return { n: 'dash', v: 30 };
                    }
                    if (ctx.nearestOpponent && ctx.nearestOpponent.distance < 2.5) {
                        const avoid = ctx.nearestOpponent.direction >= 0 ? -50 : 50;
                        return { n: 'kick', v: [35, avoid] };
                    }
                    if (!ctx.goalOpp) {
                        return { n: 'kick', v: [30, 35] };
                    }
                    if (Math.abs(ctx.goalOpp.direction) > 8) {
                        return { n: 'turn', v: ctx.goalOpp.direction };
                    }
                    return { n: 'turn', v: 0 };
                },
                transitions: [
                    {
                        to: 'run_to_ball',
                        guard: (ctx) => !ctx.ball || ctx.ball.distance > 1.0,
                        reset: ['t'],
                    },
                    {
                        to: 'kick_goal',
                        guard: (ctx) => !!ctx.goalOpp && Math.abs(ctx.goalOpp.direction) <= 8,
                        reset: ['t'],
                    },
                    {
                        to: 'recover',
                        guard: (ctx) => ctx.t > 8,
                        reset: ['t'],
                    },
                ],
            },
            kick_goal: {
                action(ctx, state) {
                    state.vars.kicks += 1;
                    if (ctx.goalOpp) {
                        const power = ctx.goalOpp.distance > 18 ? 100 : 75;
                        return { n: 'kick', v: [power, ctx.goalOpp.direction] };
                    }
                    return { n: 'kick', v: [40, 0] };
                },
                transitions: [
                    {
                        to: 'recover',
                        guard: () => true,
                        reset: ['t'],
                    },
                ],
            },
            recover: {
                action() {
                    return { n: 'turn', v: 30 };
                },
                transitions: [
                    {
                        to: 'search_ball',
                        guard: (ctx) => ctx.t > 6,
                        reset: ['t'],
                    },
                ],
            },
        },
    };
}

module.exports = createAttackerMachine;
