'use strict';

class ObjectFilter {
    constructor({ alphaDistance = 0.55 } = {}) {
        this.alphaDistance = alphaDistance;
        this.state = new Map();
    }

    keyFor(obj) {
        return obj.name;
    }

    update(objects) {
        const result = [];
        for (const obj of objects) {
            const key = this.keyFor(obj);
            const previous = this.state.get(key);
            const filtered = { ...obj };

            if (previous) {
                if (typeof obj.distance === 'number' && typeof previous.distance === 'number') {
                    filtered.distance = previous.distance * (1 - this.alphaDistance) + obj.distance * this.alphaDistance;
                }
            }

            this.state.set(key, { distance: filtered.distance, direction: obj.direction });
            result.push(filtered);
        }
        return result;
    }
}

module.exports = ObjectFilter;
