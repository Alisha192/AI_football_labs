'use strict';

const RAW_FLAGS_BOOK_COORDS = {
    'f c': { x: 0, y: 0 },
    'f c t': { x: 0, y: 34 },
    'f c b': { x: 0, y: -34 },

    'f t l 50': { x: -50, y: 39 },
    'f t l 40': { x: -40, y: 39 },
    'f t l 30': { x: -30, y: 39 },
    'f t l 20': { x: -20, y: 39 },
    'f t l 10': { x: -10, y: 39 },
    'f t 0': { x: 0, y: 39 },
    'f t r 10': { x: 10, y: 39 },
    'f t r 20': { x: 20, y: 39 },
    'f t r 30': { x: 30, y: 39 },
    'f t r 40': { x: 40, y: 39 },
    'f t r 50': { x: 50, y: 39 },

    'f b l 50': { x: -50, y: -39 },
    'f b l 40': { x: -40, y: -39 },
    'f b l 30': { x: -30, y: -39 },
    'f b l 20': { x: -20, y: -39 },
    'f b l 10': { x: -10, y: -39 },
    'f b 0': { x: 0, y: -39 },
    'f b r 10': { x: 10, y: -39 },
    'f b r 20': { x: 20, y: -39 },
    'f b r 30': { x: 30, y: -39 },
    'f b r 40': { x: 40, y: -39 },
    'f b r 50': { x: 50, y: -39 },

    'f l t 30': { x: -57.5, y: 30 },
    'f l t 20': { x: -57.5, y: 20 },
    'f l t 10': { x: -57.5, y: 10 },
    'f l 0': { x: -57.5, y: 0 },
    'f l b 10': { x: -57.5, y: -10 },
    'f l b 20': { x: -57.5, y: -20 },
    'f l b 30': { x: -57.5, y: -30 },

    'f r t 30': { x: 57.5, y: 30 },
    'f r t 20': { x: 57.5, y: 20 },
    'f r t 10': { x: 57.5, y: 10 },
    'f r 0': { x: 57.5, y: 0 },
    'f r b 10': { x: 57.5, y: -10 },
    'f r b 20': { x: 57.5, y: -20 },
    'f r b 30': { x: 57.5, y: -30 },

    'f l t': { x: -52.5, y: 34 },
    'f l b': { x: -52.5, y: -34 },
    'f r t': { x: 52.5, y: 34 },
    'f r b': { x: 52.5, y: -34 },

    'f g l t': { x: -52.5, y: 7.01 },
    'f g l b': { x: -52.5, y: -7.01 },
    'f g r t': { x: 52.5, y: 7.01 },
    'f g r b': { x: 52.5, y: -7.01 },

    'f p l t': { x: -36, y: 20.15 },
    'f p l c': { x: -36, y: 0 },
    'f p l b': { x: -36, y: -20.15 },
    'f p r t': { x: 36, y: 20.15 },
    'f p r c': { x: 36, y: 0 },
    'f p r b': { x: 36, y: -20.15 },

    'g l': { x: -52.5, y: 0 },
    'g r': { x: 52.5, y: 0 },
};

function invertYCoords(raw) {
    const out = {};
    for (const [key, point] of Object.entries(raw)) {
        out[key] = { x: point.x, y: -point.y };
    }
    return out;
}

const FLAGS = Object.freeze(invertYCoords(RAW_FLAGS_BOOK_COORDS));

function getPoint(name) {
    return FLAGS[name] || null;
}

function hasPoint(name) {
    return Object.prototype.hasOwnProperty.call(FLAGS, name);
}

module.exports = {
    FLAGS,
    getPoint,
    hasPoint,
};
