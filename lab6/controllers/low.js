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

        // 1) Абсолютный приоритет локального рефлекса вратаря.
        // Если мяч близко и в зоне захвата, сразу выполняем catch,
        // не отдавая управление выше.
        if (input.role === 'goalie' && input.features.ballClose && ball && Math.abs(ball.direction) < 30) {
            return { n: 'catch', v: ball.direction };
        }

        // 2) Во всех остальных случаях решение принимают уровни выше (Middle -> High).
        const command = next(input);

        // 3) Никаких fallback на input.command на уровне Low:
        // Low не должен затирать стратегический kick от High.
        return command;
    }
}

module.exports = LowController;
