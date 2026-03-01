/*
 * Дерево решений вратаря: позиционирование, выбор момента для перехвата и сейва.
 */

const gatesFl = "gr";
const left_flag = 'gl';

//     Основная структура стратегии: дерево решений или конечный автомат поведения.
const DT = {
	//     Хранилище рабочих переменных автомата/контроллера между циклами.
	state: {
		inGates: false,
		command: null,
		kick: {act: "kick", fl: "b", goal: "gl"},
		catch: 0,
	},
	//     Стартовый узел: инициализирую действие и направляю поток в нужную ветку.
	root: {
		exec(mgr, state, p){
			state.command = null; 
		},
		next: "checkGates",
	},	
	//     Отдельный узел логики: проверка условия или генерация команды.
	checkGates: {
		condition: (mgr, state, p) => state.inGates,
		trueCond: "isCatched",
		falseCond: "goalVisible",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	isCatched: {
		condition: (mgr, state, p) => state.catch > 0,
		trueCond: "kickOut",
		falseCond: "controlBall",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	kickOut: {
		condition: (mgr, state, p) => mgr.getVisible(left_flag, p),
		trueCond: "leftGatesAngle",
		falseCond: "rotate",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	leftGatesAngle: {
		exec(mgr, state, p){
			state.left_gates_angle = mgr.getAngle(left_flag, p);
		},
		next: "kickBall",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	kickBall: {
		exec(mgr, state, p){
			state.command = {n: "kick", v: "100" + " " + state.left_gates_angle};
		},
		next: "reset",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	reset: {
		exec(mgr, state, p){
			state.inGates = false;
			state.catch = 0;
		},
		next: 'sendCommand',
	},

/*
		exec(mgr, state, p){
			state.command = {n: 'kick', v: "100 0"}
		},
		next: "sendCommand",

*/
	//     Отдельный узел логики: проверка условия или генерация команды.
	controlBall: {
		condition: (mgr, state, p) => mgr.getVisible('b', p),
		trueCond: "ballMeasures",
		falseCond: "rotate",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	ballMeasures: {
		exec(mgr, state, p){
			state.ballAngle = mgr.getAngle('b', p);
			state.ballDistance = mgr.getDistance('b', p);
		},
		next: "canCatch",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	canCatch: {
		condition: (mgr, state, p) => state.ballDistance < 0.5,
		trueCond: "catchBall",
		falseCond: "closeAngle",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	catchBall: {
		exec(mgr, state, p){
			state.command = {n: 'catch', v: -state.ballAngle};
			state.catched = true;
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	closeAngle: {
		condition: (mgr, state, p) => Math.abs(state.ballAngle) < 5,
		trueCond: "ballClose",
		falseCond: "turnBody",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	ballClose: {
		condition: (mgr, state, p) => state.ballDistance < 10,
		trueCond: "playerVisible",
		falseCond: "sendCommand", 
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	playerVisible: {
		condition: (mgr, state, p) => mgr.getVisible("p", p),
		trueCond: "playerDistance",
		falseCond: "runToGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	playerDistance: {
		exec(mgr, state, p){
			state.playerDistance = mgr.getDistance("p", p);
		},
		next: "playerClose",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	playerClose: {
		condition: (mgr, state, p) => ((state.playerDistance - state.ballDistance) > 0 && (state.playerDistance - state.ballDistance) > state.ballDistance),
		trueCond: "runToGoal",
		falseCond: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	turnBody: {
		exec(mgr, state, p){
			state.command = {n: 'turn', v: state.ballAngle};
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	goalVisible: {
		condition(mgr, state, p){
			return mgr.getVisible(gatesFl, p);
		},
		trueCond: "flagSeek",
		falseCond: "rotate",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	rotate: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: 90}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	flagSeek: {
		condition: (mgr, state, p) => 3 > mgr.getDistance(gatesFl, p),
		trueCond: "closeFlag",
		falseCond: "farGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	closeFlag: {
		exec(mgr, state, p){
			state.inGates = true;
			let angle = mgr.getAngle(gatesFl, p);
			let turnAngle = angle + 180;
			if (turnAngle > 180){
				turnAngle = -(360 - turnAngle);
			}
			state.command 
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	farGoal: {
		condition: (mgr, state, p) => mgr.getAngle(gatesFl, p) > 4,
		trueCond: "rotateToGoal",
		falseCond: "runToGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	rotateToGoal: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: mgr.getAngle(gatesFl, p)}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	runToGoal: {
		exec(mgr, state, p){
			state.command = {n: "dash", v: 100};
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	sendCommand: {
		command: (mgr, state) => state.command,
	},
}

//     Экспортирую стратегию/контроллер для подключения в агенте.
module.exports = DT;
