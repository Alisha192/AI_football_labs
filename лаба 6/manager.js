/*
 * Менеджер принятия решений: связываю дерево решений с текущим состоянием агента и получаю итоговую команду.
 */

const utils = require("./utils");

//     Менеджер — слой между деревом решений и реальными сенсорными данными агента.
class Manager{

	//     Рекурсивно прохожу по узлам дерева и возвращаю итоговую команду.
	getAction(dt, p){
		function execute(dt, title, p){
			const action = dt[title];

			if (typeof action.exec == "function"){
				action.exec(Manager, dt.state, p);
				return execute(dt, action.next, p);
			}
			if (typeof action.condition == "function"){
				const cond = action.condition(Manager, dt.state, p);
				if (cond){
					return execute(dt, action.trueCond, p);
				}
				return execute(dt, action.falseCond, p);
			}
			if (typeof action.command == "function"){
				return action.command(Manager, dt.state);
			}
			throw new Error(`Unexpected node in DT: ${title}`);
		}
		return execute(dt, "root", p);
	}

	//     Проверяю, присутствует ли объект в текущем наблюдении.
	static getVisible(obj_name, p){
		let obj = utils.see_object(obj_name, p);
		//console.log(obj);
		if (obj){
			return true;
		}
		return false;
	}

	//     Возвращаю дистанцию до целевого объекта.
	static getDistance(obj_name, p){
		let obj = utils.see_object(obj_name, p);
		return obj[0];
	}

	//     Возвращаю угол до целевого объекта.
	static getAngle(obj_name, p){
		let obj = utils.see_object(obj_name, p);
		return obj[1];
	}

	//     Читаю направление корпуса/взгляда наблюдаемого игрока.
	static getFaceDir(obj_name, p){
		let obj = utils.see_object(obj_name, p);
		console.log("OBJECT: ", obj);
		return obj[4];
	}
}

module.exports = Manager;
