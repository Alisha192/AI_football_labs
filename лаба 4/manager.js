/*
 * Менеджер принятия решений: связываю дерево решений с текущим состоянием агента и получаю итоговую команду.
 */

const utils = require("./utils");

//     Менеджер — слой между деревом решений и реальными сенсорными данными агента.
class Manager{

	//     Рекурсивно прохожу по узлам дерева и возвращаю итоговую команду.
	getAction(dt, p, cmd){
		function execute(dt, title, p, cmd){
			const action = dt[title];
			console.log(title);

			if (typeof action.exec == "function"){
				action.exec(Manager, dt.state, p, cmd);
				return execute(dt, action.next, p, cmd);
			}
			if (typeof action.condition == "function"){
				const cond = action.condition(Manager, dt.state, p, cmd);
				if (cond){
					return execute(dt, action.trueCond, p, cmd);
				}
				return execute(dt, action.falseCond, p, cmd);
			}
			if (typeof action.command == "function"){
				return action.command(Manager, dt.state);
			}
			throw new Error(`Unexpected node in DT: ${title}`);
		}
		return execute(dt, "root", p, cmd);
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
		return obj[4];
	}

	//     Определяю, идёт ли активная игра (play_on).
	static isPlayOn(p, prev){
		if (prev){
			if (p[2].includes("goal")){
				return false;
			}
			return true;
		}
		if (p[2] === "play_on"){
			return true;
		}
		return false;
	}

	//     Обрабатываю служебный сигнал go из канала hear.
	static hearGo(p){
		console.log(p, p[2].includes("go"));
		return p[2].includes("go");
	}

	//     Преобразую расстояние в удобную силу действия.
	static getStrength(distance){
		return Math.min(100, Math.floor(distance * 5));
	}

	//     Заготовка для комбинированного расчёта угла и силы.
	static getAngleAndStrength(p){

	}
}

module.exports = Manager;
