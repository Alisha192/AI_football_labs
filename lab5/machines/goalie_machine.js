'use strict';

function createGoalieMachine(agent) {
    const nav = agent.navigator;

    return {
        initial: 'return_goal',
        states: {
            return_goal: {
                action(ctx) {
                    if (!ctx.ownGoal) return nav.search(Math.floor(ctx.t));
                    if (Math.abs(ctx.ownGoal.direction) > 8) {
                        return { n: 'turn', v: ctx.ownGoal.direction };
                    }
                    if (ctx.ownGoal.distance > 1.8) {
                        return { n: 'dash', v: 50 };
                    }
                    return { n: 'turn', v: 20 };
                },
                transitions: [
                    {
                        to: 'track_ball',
                        guard: (ctx) => ctx.ball && ctx.ball.distance < 20,
                        reset: ['t'],
                    },
                ],
            },
            track_ball: {
                action(ctx) {
                    if (!ctx.ball) return { n: 'turn', v: 30 };
                    if (Math.abs(ctx.ball.direction) > 8) return { n: 'turn', v: ctx.ball.direction };
                    return { n: 'dash', v: 70 };
                },
                transitions: [
                    {
                        to: 'return_goal',
                        guard: (ctx) => !ctx.ball && ctx.t > 5,
                        reset: ['t'],
                    },
                    {
                        to: 'intercept',
                        guard: (ctx) => ctx.ball && ctx.ball.distance < 8,
                        reset: ['t'],
                    },
                    {
                        to: 'attempt_catch',
                        guard: (ctx) => ctx.ball && ctx.ball.distance < 2,
                        reset: ['t'],
                    },
                ],
            },
            intercept: {
                action(ctx) {
                    if (!ctx.ball) return { n: 'turn', v: 35 };
                    if (Math.abs(ctx.ball.direction) > 10) return { n: 'turn', v: ctx.ball.direction };
                    return { n: 'dash', v: 90 };
                },
                transitions: [
                    {
                        to: 'attempt_catch',
                        guard: (ctx) => ctx.ball && ctx.ball.distance < 2,
                        reset: ['t'],
                    },
                    {
                        to: 'return_goal',
                        guard: (ctx) => (!ctx.ball || ctx.ball.distance > 12) && ctx.t > 5,
                        reset: ['t'],
                    },
                ],
            },
            attempt_catch: {
                action(ctx) {
                    if (ctx.ball && ctx.ball.distance < 2 && Math.abs(ctx.ball.direction) < 35) {
                        return { n: 'catch', v: ctx.ball.direction };
                    }
                    return { n: 'turn', v: 0 };
                },
                transitions: [
                    {
                        to: 'clear_ball',
                        guard: (ctx) => ctx.t > 1,
                        reset: ['t'],
                    },
                ],
            },
            clear_ball: {
                action(ctx) {
                    if (ctx.ball && ctx.ball.distance < 1.2) {
                        if (ctx.goalOpp) {
                            return { n: 'kick', v: [100, ctx.goalOpp.direction] };
                        }
                        return { n: 'kick', v: [85, 0] };
                    }
                    if (ctx.ball && Math.abs(ctx.ball.direction) > 10) {
                        return { n: 'turn', v: ctx.ball.direction };
                    }
                    return { n: 'dash', v: 60 };
                },
                transitions: [
                    {
                        to: 'return_goal',
                        guard: (ctx) => ctx.t > 3,
                        reset: ['t'],
                    },
                ],
            },
        },
    };
}

module.exports = createGoalieMachine;
