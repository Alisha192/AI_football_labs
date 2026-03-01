/*
 * Нижний контур управления вратарём: быстрые защитные реакции и базовые перемещения.
 */

//     Основная структура стратегии: дерево решений или конечный автомат поведения.
const CTRL_LOW = {
	execute(taken, controllers){
		const next = controllers[0];
		taken.canKick = taken.state.ball && taken.state.ball.dist < 0.5;
		//taken.canCatch = taken.state.ball && taken.state.ball.dist < 2;
		if (next){
			return next.execute(taken, controllers.slice(1));
		} 
	}
}

//     Экспортирую стратегию/контроллер для подключения в агенте.
module.exports = CTRL_LOW;
