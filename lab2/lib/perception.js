'use strict';

function cleanToken(token) {
    if (typeof token !== 'string') return token;
    if (token.length >= 2 && token[0] === '"' && token[token.length - 1] === '"') {
        return token.slice(1, -1);
    }
    return token;
}

function toNumberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cmdTokens(cmdNode) {
    if (typeof cmdNode === 'string') return [cleanToken(cmdNode)];
    if (!cmdNode || !Array.isArray(cmdNode.p)) return [];
    const head = typeof cmdNode.cmd === 'string' ? [cleanToken(cmdNode.cmd)] : [];
    return head.concat(cmdNode.p.map(cleanToken));
}

function inferKind(tokens) {
    if (tokens.length === 0) return 'unknown';
    switch (tokens[0]) {
    case 'f':
        return 'flag';
    case 'g':
        return 'goal';
    case 'b':
        return 'ball';
    case 'p':
        return 'player';
    case 'l':
        return 'line';
    default:
        return 'unknown';
    }
}

function parsePlayer(tokens) {
    const result = { team: null, unum: null, goalie: false };
    if (tokens[0] !== 'p') return result;

    for (let i = 1; i < tokens.length; i += 1) {
        const value = tokens[i];
        if (value === 'goalie') {
            result.goalie = true;
        } else if (typeof value === 'number') {
            result.unum = value;
        } else if (typeof value === 'string') {
            if (/^-?\d+$/.test(value)) {
                result.unum = parseInt(value, 10);
            } else {
                result.team = value;
            }
        }
    }
    return result;
}

function parseSee(node) {
    if (!node || node.cmd !== 'see' || !Array.isArray(node.p) || node.p.length === 0) {
        return null;
    }

    const time = toNumberOrNull(node.p[0]);
    if (time === null) return null;

    const objects = [];
    for (let i = 1; i < node.p.length; i += 1) {
        const obj = node.p[i];
        if (!obj || typeof obj !== 'object' || !obj.cmd) continue;

        const tokens = cmdTokens(obj.cmd);
        const name = tokens.join(' ');
        const kind = inferKind(tokens);
        const params = Array.isArray(obj.p) ? obj.p : [];

        const parsed = {
            kind,
            tokens,
            name,
            distance: toNumberOrNull(params[0]),
            direction: toNumberOrNull(params[1]),
            distChange: toNumberOrNull(params[2]),
            dirChange: toNumberOrNull(params[3]),
            bodyDir: toNumberOrNull(params[4]),
            headDir: toNumberOrNull(params[5]),
            raw: obj,
        };

        if (kind === 'player') {
            Object.assign(parsed, parsePlayer(tokens));
        }

        objects.push(parsed);
    }

    return { time, objects };
}

function parseHear(node) {
    if (!node || node.cmd !== 'hear' || !Array.isArray(node.p) || node.p.length < 3) {
        return null;
    }

    return {
        time: toNumberOrNull(node.p[0]),
        sender: cleanToken(node.p[1]),
        message: cleanToken(node.p[2]),
    };
}

function byName(objects, name) {
    if (!Array.isArray(objects)) return null;
    for (const obj of objects) {
        if (obj.name === name) return obj;
    }
    return null;
}

function nearestByName(objects, name) {
    if (!Array.isArray(objects)) return null;
    let best = null;
    for (const obj of objects) {
        if (obj.name !== name) continue;
        if (obj.distance === null) continue;
        if (!best || obj.distance < best.distance) {
            best = obj;
        }
    }
    return best;
}

module.exports = {
    parseSee,
    parseHear,
    byName,
    nearestByName,
};
