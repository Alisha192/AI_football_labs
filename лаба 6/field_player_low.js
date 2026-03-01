/*
 * Нижний уровень полевого игрока: базовые реакции и простые исполнительные действия.
 */

const utils = require("./utils");

//     Основная структура стратегии: дерево решений или конечный автомат поведения.
const CTRL_LOW = {
	execute(taken, controllers, bottom, top, direction, center){
		if (!taken.state.pos){
			return {n: "turn", v: 10};
		}
		const next = controllers[0];
		if (!taken.state.ball){
			//console.log("return in Zone");
			let act = utils.returnInZone(taken.state.pos.y, bottom, top, direction, taken);
			if (act){
				return act;
			}
			//console.log("in Zone. Finding ball");
			return utils.turn(1, 90);
		}
		if (next){
			return next.execute(taken, controllers.slice(1), bottom, top, direction, center);
		} 
	}
}

//     Экспортирую стратегию/контроллер для подключения в агенте.
module.exports = CTRL_LOW;
