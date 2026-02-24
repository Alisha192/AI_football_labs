'use strict';

class Hierarchy {
    constructor(controllers) {
        this.controllers = controllers;
    }

    execute(input) {
        const walk = (index, currentInput) => {
            if (index >= this.controllers.length) {
                return currentInput.command || null;
            }
            const controller = this.controllers[index];
            return controller.execute(currentInput, (nextInput = currentInput) => walk(index + 1, nextInput));
        };

        return walk(0, input);
    }
}

module.exports = Hierarchy;
