'use strict';

const { normalizeAngle } = require('./math');

class ObjectFilter {
    constructor({ alphaDistance = 0.55, alphaDirection = 0.45 } = {}) {
        this.alphaDistance = alphaDistance;
        this.alphaDirection = alphaDirection;
        this.state = new Map();
    }

    keyFor(obj) {
        return obj.name;
    }

    blendAngle(prev, next, alpha) {
        const delta = normalizeAngle(next - prev);
        return normalizeAngle(prev + delta * alpha);
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
                if (typeof obj.direction === 'number' && typeof previous.direction === 'number') {
                    filtered.direction = this.blendAngle(previous.direction, obj.direction, this.alphaDirection);
                }
            }

            this.state.set(key, { distance: filtered.distance, direction: filtered.direction });
            result.push(filtered);
        }
        return result;
    }
}

module.exports = ObjectFilter;
