/*
 * Дерево решений для выхода на удар и завершения атаки по воротам.
 */

const FL = "flag", KI = "kick"
//     Основная структура стратегии: дерево решений или конечный автомат поведения.
const DT = {
	//     Хранилище рабочих переменных автомата/контроллера между циклами.
	state: {
		next: 0,
		sequence: [{act: FL, fl: "gl"},
			{act: KI, fl: "b", goal: "gr"}],
		command: null
	},
	//     Стартовый узел: инициализирую действие и направляю поток в нужную ветку.
	root: {
		exec(mgr, state, p){
			state.action = state.sequence[state.next];
			state.command = null
		},
		next: "goalVisible",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	goalVisible: {
		condition(mgr, state, p){
			return mgr.getVisible(state.action.fl, p);
		},
		trueCond: "rootNext",
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
	rootNext: {
		condition: (mgr, state, p) => state.action.act == FL,
		trueCond: "flagSeek",
		falseCond: "ballSeek",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	flagSeek: {
		condition: (mgr, state, p) => 3 > mgr.getDistance(state.action.fl, p),
		trueCond: "closeFlag",
		falseCond: "farGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	closeFlag: {
		exec(mgr, state, p){
			state.next++;
			state.action = state.sequence[state.next];
		},
		next: "goalVisible",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	farGoal: {
		condition: (mgr, state, p) => mgr.getAngle(state.action.fl, p) > 4,
		trueCond: "rotateToGoal",
		falseCond: "runToGoal",
	},
	//     Отдельный узел логики: проверка условия или генерация команды.
	rotateToGoal: {
		exec(mgr, state, p){
			state.command = {n: "turn", v: mgr.getAngle(state.action.fl, p)}
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
	//     Отдельный узел логики: проверка условия или генерация команды.
	ballSeek: {
		condition: (mgr, state, p) => 0.5 > mgr.getDistance(state.action.fl, p),
		trueCond: "closeBall",
		falseCond: "farGoal",
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
			state.command = {n: "kick", v: "10 45"}
		},
		next: "sendCommand",
	},
}

//     Экспортирую стратегию/контроллер для подключения в агенте.
module.exports = DT;

