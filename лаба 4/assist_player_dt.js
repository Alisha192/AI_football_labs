/*
 * Дерево решений ассистирующего игрока: открывание, подстройка под эпизод и подготовка передачи.
 */

const rotationSpeed = 45;
const goalAngle = 3;
const flagCloseness = 3;
const ballCloseness = 0.5;
const runSpeed = 100;
const waitTime = 10;
const passAngleChange = 40;
const slowDownDistance = 3;
const slowDownCoefficient = 0.8;
const distance_treshold = 20;

//     Основная структура стратегии: дерево решений или конечный автомат поведения.
const DT = {
	//     Хранилище рабочих переменных автомата/контроллера между циклами.
	state: {
		next: 0,
		wait: 0,
		stay: false,
		previous_play_on: false,
		cur_play_on: false,
		start_coords: [-20, 0],
		player_angle: null,
		player_distance: null,
		message: false,
		sequence: [{act: "flag", fl: "fplc"}, {act: "flag", fl: "b"}],
	},
	//     Стартовый узел: инициализирую действие и направляю поток в нужную ветку.
	root: {
		exec(mgr, state, p, cmd){
			state.action = state.sequence[state.next];
			state.command = null;
		},
		next: "messageSay",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	messageSay: {
		condition: (mgr, state, p, cmd) => state.message,
		trueCond: "summonPlayer",
		falseCond: "start",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	summonPlayer: {
		exec(mgr, state, p, cmd){
			state.command = {n: "say", v: "go"};
			state.stay = true;
			state.message = false;
		},
		next: "sendCommand",
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
			;
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
		trueCond: "sendCommand",
		falseCond: "isMoved",
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
			state.wait = 0;
			state.stay = false;
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	seeProcessing: {
		condition: (mgr, state, p, cmd) => state.cur_play_on && !state.stay,
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
		trueCond: "assist",
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
	flagSeek: {
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
	assist: {
		condition: (mgr, state, p, cmd) => mgr.getVisible('p', p),
		trueCond: "pass",
		falseCond: "wait",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	wait: {
		condition: (mgr, state, p, cmd) => state.wait >= waitTime,
		trueCond: "findPlayer",
		falseCond: "waitIncrement",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	waitIncrement: {
		exec(mgr, state, p, cmd){
			state.wait += 1;
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	findPlayer: {
		exec(mgr, state, p){
			state.command = {n: "kick", v: "10 45"}
		},
		next: "sendCommand",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	pass: {
		exec(mgr, state, p, cmd){
			//let params = mgr.getAngleAndStrength(p);


			state.player_angle = mgr.getAngle("p", p);
			state.player_distance = mgr.getDistance("p", p);
			
			let kick_strength = mgr.getStrength(state.player_distance);
			let angle_change = 30;
			if (state.player_distance >= distance_treshold){
				angle_change = 15;
			}
			let kick_angle = state.player_angle - angle_change;

			state.command = {n: "kick", v: kick_strength + " " + kick_angle};
			state.message = true;
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
