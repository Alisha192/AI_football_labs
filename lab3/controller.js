/**
 * @module lab3/controller.js
 * Контроллер уровня поведения: оркеструет выбор действий между тактикой и примитивами управления.
 */

class Controller{
	constructor(acts){
		this.acts = acts;
		this.cur = 0;
	}

	get_current_task(){
		return this.acts[this.cur];
	}
}


module.exports = Controller;
