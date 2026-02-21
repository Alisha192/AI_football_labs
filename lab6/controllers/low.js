'use strict';

class LowController {
    execute(input, next) {
        const ball = input.ball;
        input.features = {
            hasBall: !!ball,
            canKick: !!ball && ball.distance !== null && ball.distance <= 0.8,
            ballClose: !!ball && ball.distance !== null && ball.distance <= 2.0,
            opponentPressure: !!input.nearestOpponent
                && input.nearestOpponent.distance !== null
                && input.nearestOpponent.distance < 2.5,
        };

        if (input.role === 'goalie' && input.features.ballClose && ball && Math.abs(ball.direction) < 30) {
            input.command = { n: 'catch', v: ball.direction };
        }

        const command = next(input);
        return command || input.command;
    }
}

module.exports = LowController;
