/*
 * Дерево решений завершающего игрока: выбор позиции под мяч и попытка удара в оптимальный момент.
 */

const rotationSpeed = -45;
const goalAngle = 3;
const flagCloseness = 3;
const ballCloseness = 0.5;
const runSpeed = 85;
const waitTime = 20;
const passAngleChange = 30;
const slowDownDistance = 3;
const slowDownCoefficient = 0.8;

//     Основная структура стратегии: дерево решений или конечный автомат поведения.
const DT = {
	//     Хранилище рабочих переменных автомата/контроллера между циклами.
	state: {
		next: 0,
		go: 0,
		previous_play_on: false,
		cur_play_on: false,
		start_coords: [-20, 20],
		turn_angle: 0,
		sequence: [{act: "flag", fl: "fplb"}, {act: "flag", fl: "fgrb"}, {act: "kick", fl: "b", goal: "gr"}],
	},
	//     Стартовый узел: инициализирую действие и направляю поток в нужную ветку.
	root: {
		exec(mgr, state, p, cmd){
			state.action = state.sequence[state.next];
			state.command = null;
		},
		next: "start",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	start: {
		condition: (mgr, state, p, cmd) => cmd === "hear",
		trueCond: "hearProcessing",
		falseCond: "seeOrSenseProcessing",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	seeOrSenseProcessing: {
		condition: (mgr, state, p, cmd) => cmd === "see",
		trueCond: "seeProcessing",
		falseCond: "senseProcessing",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	senseProcessing: {
		exec(mgr, state, p, cmd){
			if (cmd === "sense_body"){
				//console.log(p);
				state.turn_angle = p[3]['p'][1];	
			}
			
		},
		next: "sendCommand",
	},

	//     Отдельный узел логики: проверка условия или генерация команды.
	hearProcessing: {
		exec(mgr, state, p, cmd){
			state.previous_play_on = state.cur_play_on;
			state.cur_play_on = mgr.isPlayOn(p, state.cur_play_on);
		},
		next: "checkPlayMode",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	checkPlayMode: {
		condition: (mgr, state, p, cmd) => state.cur_play_on,
		trueCond: "goCheck",
		falseCond: "isMoved",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	goCheck: {
		exec(mgr, state, p, cmd){
			let curGo = mgr.hearGo(p);
			if (curGo){
				state.go = true;
			}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	isMoved: {
		condition: (mgr, state, p, cmd) => state.previous_play_on,
		trueCond: "move2start", 
		falseCond: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	move2start: {
		exec(mgr, state, p, cmd){
			state.command = {n: "move", v: state.start_coords[0] + " " + state.start_coords[1]};
			state.next = 0;
			state.go = false;
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	seeProcessing: {
		condition: (mgr, state, p, cmd) => state.cur_play_on,
		trueCond: "goalPath",
		falseCond: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	goalPath: {
		condition(mgr, state, p, cmd){
			return mgr.getVisible(state.action.fl, p);
		},
		trueCond: "rootNext",
		falseCond: "rotate",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	rotate: {
		exec(mgr, state, p, cmd){
			state.command = {n: "turn", v: rotationSpeed}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	rootNext: {
		condition: (mgr, state, p, cmd) => state.action.fl === "b",
		trueCond: "ballSeek",
		falseCond: "flagSeek",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	ballSeek: {
		condition: (mgr, state, p) => ballCloseness > mgr.getDistance(state.action.fl, p),
		trueCond: "closeBall",
		falseCond: "checkFar",				
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	checkFar: {
		condition: (mgr, state, p, cmd) => slowDownDistance > mgr.getDistance(state.action.fl, p),
		trueCond: "slowRun",
		falseCond: "farGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	slowRun: {
		condition: (mgr, state, p, cmd) => Math.abs(mgr.getAngle(state.action.fl, p)) > goalAngle,
		trueCond: "rotateToGoal",
		falseCond: "runSlow", 
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	runSlow: {
		exec(mgr, state, p, cmd){
			state.command = {n: "dash", v: Math.floor(runSpeed * slowDownCoefficient)};
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	closeBall: {
		condition: (mgr, state, p) => mgr.getVisible(state.action.goal, p),
		trueCond: "ballGoalVisible",
		falseCond: "ballGoalInvisible",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	ballGoalVisible: {
		exec(mgr, state, p){
			state.command = {n: "kick", v: `100 ${mgr.getAngle(state.action.goal, p)}`}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	ballGoalInvisible: {
		exec(mgr, state, p){
			let angle = -45;
			if (state.turn_angle < 0){
				angle = 45;
			}
			angle = 45;
			state.command = {n: "kick", v: "10 " + angle};
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	flagSeek: {
		condition: (mgr, state, p, cmd) => state.go && mgr.getVisible("b", p),
		trueCond: "score",
		falseCond: "catchFlag",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	score: {
		exec(mgr, state, p, cmd){
			state.next = 2;
		},
		next: "ballSeek",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	catchFlag: {
		condition: (mgr, state, p, cmd) => flagCloseness > mgr.getDistance(state.action.fl, p),
		trueCond: "closeFlag",
		falseCond: "farGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	closeFlag: {
		exec(mgr, state, p, cmd){
			state.next++;
			state.action = state.sequence[state.next];
		},
		next: "seeProcessing",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	farGoal: {
		condition: (mgr, state, p, cmd) => Math.abs(mgr.getAngle(state.action.fl, p)) > goalAngle,
		trueCond: "rotateToGoal",
		falseCond: "runToGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	rotateToGoal: {
		exec(mgr, state, p, cmd){
			state.command = {n: "turn", v: mgr.getAngle(state.action.fl, p)}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	runToGoal: {
		exec(mgr, state, p, cmd){
			state.command = {n: "dash", v: runSpeed};
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	sendCommand: {
		command: (mgr, state, p, cmd) => state.command,
	},
}

//     Экспортирую стратегию/контроллер для подключения в агенте.
module.exports = DT;
