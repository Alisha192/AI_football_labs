/*
 * Дерево решений для игрока второго эшелона: поддержка атаки, выбор зоны и работа без мяча.
 */

const FL = "flag", KI = "kick", PL = "p";
const leaderSpeed = 40, goalAngle = 4, rotationSpeed = 75;
const fullSpeed = 100, avgSpeed = 40, lowSpeed = 20;
const farPlayerDist = 13, avgPlayerDist = 7, closePlayerDist = 2;
const holdedAngle = 35, aroundAngleLow = 20, aroundAngleHigh = 30;
const leaderStop = 7;

//    Основная структура стратегии: дерево решений или конечный автомат поведения.
const DT2 = {
	//    Хранилище рабочих переменных автомата/контроллера между циклами.
	state: {
		next: 0,
		sequence: [/*{act: FL, fl: "fcb"},*/
			{act: KI, fl: "b", goal: "gr"}],
		command: null,
		leader: null
	},
	//    Стартовый узел: инициализирую действие и направляю поток в нужную ветку.
	root: {
		exec(mgr, state, p){
			state.action = state.sequence[state.next];
			state.command = null;
		},
		next: "position",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	position: {
		condition: (mgr, state, p) => state.leader === null,
		trueCond: "definePosition", 
		falseCond: "isLeader",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	definePosition: {
		condition: (mgr, state, p) => mgr.getVisible(PL, p),
		trueCond: "slaveInit",
		falseCond: "leaderInit",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	leaderInit: {
		exec(mgr, state, p){
			state.leader = true;
		},
		next: "leaderProgram",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	slaveInit: {
		exec(mgr, state, p){
			state.leader = false;
		},
		next: "slaveProgram",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	isLeader: {
		condition: (mgr, state, p) => state.leader,
		trueCond: "leaderProgram",
		falseCond: "slaveProgram",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	slaveProgram: {
		condition: (mgr, state, p) => mgr.getVisible(PL, p),
		trueCond: "countMeasures",
		falseCond: "rotate",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	countMeasures: {
		exec(mgr, state, p){
			//state.command = null;
			state.dist = mgr.getDistance(PL, p);
			state.angle = mgr.getAngle(PL, p);
		},
		next: "seeFacingDir",		
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	seeFacingDir: {
		condition: (mgr, state, p) => state.dist <= 14,
		trueCond: "getFaceDir",
		falseCond: "collisionAvoidance",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	getFaceDir: {
		exec(mgr, state, p){
			state.faceDir = mgr.getFaceDir(PL, p);
		},
		next: "checkFaceDir",
	},
	//    Узел/блок логики: отдельное правило поведения в текущем сценарии.
	//    Отдельный узел логики: проверка условия или генерация команды.
	checkFaceDir:{
		condition: (mgr, state, p) => Math.abs(state.faceDir) <= 90,
		trueCond: "collisionAvoidance",
		falseCond: "around",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	around: {
		condition: (mgr, state, p) => (state.angle >= -aroundAngleHigh) && (state.angle <= -aroundAngleLow),
		trueCond: "dash80",
		falseCond: "turnByFaceDir",	
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	turnByFaceDir: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: state.angle + aroundAngleHigh};
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	collisionAvoidance: {
		condition: (mgr, state, p) => (state.dist < closePlayerDist && Math.abs(state.angle) < 40),
		trueCond: "rotate30",
		falseCond: "distCheck",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	rotate30: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: 30};
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	distCheck: {
		condition: (mgr, state, p) => state.dist > farPlayerDist,
		trueCond: "farPlayer",
		falseCond: "closePlayer",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	farPlayer: {
		condition: (mgr, state, p) => Math.abs(state.angle) > 5,
		trueCond: "angleRotate",
		falseCond: "dash80",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	angleRotate: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: state.angle};
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	dash80: {
		exec(mgr, state, p){
			state.command = {n: "dash", v: fullSpeed};
		},
		next: "sendCommand",		
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	closePlayer: {
		condition: (mgr, state, p) => (state.angle > 40 || state.angle < 30),
		trueCond: "holdAngle",
		falseCond: "holdDistance",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	holdAngle: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: state.angle - holdedAngle};
		},
		next: "sendCommand",				
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	holdDistance: {
		condition: (mgr, state, p) => (state.dist < avgPlayerDist),
		trueCond: "dash20",
		falseCond: "dash40",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	dash20: {
		exec(mgr, state, p){
			state.command = {n: "dash", v: lowSpeed};
		},
		next: "sendCommand",		
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	dash40: {
		exec(mgr, state, p){
			state.command = {n: "dash", v: avgSpeed};
		},
		next: "sendCommand",		
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	leaderProgram: {
		condition: (mgr, state, p) => mgr.getVisible("p", p),
		trueCond: "isSlaveClose",
		falseCond: "goalPath",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	isSlaveClose: {
		condition(mgr, state, p){
			return mgr.getDistance("p", p) < leaderStop;//closePlayerDist;
		},
		trueCond: "slowMove",
		falseCond: "goalPath",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	slowMove: {
		exec(mgr, state, p){
			state.command = {n: "dash", v: 5};
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	goalPath: {
		condition(mgr, state, p){
			return mgr.getVisible(state.action.fl, p);
		},
		trueCond: "rootNext",
		falseCond: "rotate",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	rotate: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: rotationSpeed}
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	rootNext: {
		condition: (mgr, state, p) => state.action.act == FL,
		trueCond: "flagSeek",
		falseCond: "ballSeek",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	flagSeek: {
		condition: (mgr, state, p) => 3 > mgr.getDistance(state.action.fl, p),
		trueCond: "closeFlag",
		falseCond: "farGoal",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	closeFlag: {
		exec(mgr, state, p){
			state.next++;
			state.action = state.sequence[state.next];
		},
		next: "leaderProgram",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	farGoal: {
		condition: (mgr, state, p) => Math.abs(mgr.getAngle(state.action.fl, p)) > goalAngle,
		trueCond: "rotateToGoal",
		falseCond: "runToGoal",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	rotateToGoal: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: mgr.getAngle(state.action.fl, p)}
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	runToGoal: {
		exec(mgr, state, p){
			state.command = {n: "dash", v: leaderSpeed};
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	sendCommand: {
		command: (mgr, state) => state.command,
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	ballSeek: {
		condition: (mgr, state, p) => 0.5 > mgr.getDistance(state.action.fl, p),
		trueCond: "closeBall",
		falseCond: "farGoal",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	closeBall: {
		condition: (mgr, state, p) => mgr.getVisible(state.action.goal, p),
		trueCond: "ballGoalVisible",
		falseCond: "ballGoalInvisible",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	ballGoalVisible: {
		exec(mgr, state, p){
			state.command = {n: "kick", v: `100 ${mgr.getAngle(state.action.goal, p)}`}
		},
		next: "sendCommand",
	},
	//    Отдельный узел логики: проверка условия или генерация команды.
	ballGoalInvisible: {
		exec(mgr, state, p){
			state.command = {n: "kick", v: "10 45"}
		},
		next: "sendCommand",
	},
}

//    Экспортирую стратегию/контроллер для подключения в агенте.
module.exports = DT2;
