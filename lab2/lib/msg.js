'use strict';

function stripNullTerminator(msg) {
    if (typeof msg !== 'string') return '';
    if (msg.endsWith('\u0000')) {
        return msg.slice(0, -1);
    }
    return msg;
}

function toAtom(token) {
    if (token.length >= 2 && token[0] === '"' && token[token.length - 1] === '"') {
        return token.slice(1, -1);
    }
    if (/^-?\d+(?:\.\d+)?$/.test(token)) {
        return parseFloat(token);
    }
    return token;
}

function parseNode(tokens, index) {
    if (tokens[index.value] !== '(') {
        return null;
    }
    index.value += 1;

    const values = [];
    while (index.value < tokens.length && tokens[index.value] !== ')') {
        if (tokens[index.value] === '(') {
            const child = parseNode(tokens, index);
            if (child) values.push(child);
            continue;
        }
        values.push(toAtom(tokens[index.value]));
        index.value += 1;
    }

    if (tokens[index.value] !== ')') {
        return null;
    }
    index.value += 1;

    const node = { p: values };
    if (values.length > 0) {
        node.cmd = values[0];
        node.p = values.slice(1);
    }
    return node;
}

function parseMsg(raw) {
    const msg = stripNullTerminator(raw);
    if (!msg) return null;

    const tokens = msg.match(/\(|\)|"[^"]*"|[^\s()]+/g);
    if (!tokens || tokens.length === 0) return null;

    const index = { value: 0 };
    const root = parseNode(tokens, index);
    if (!root || typeof root.cmd !== 'string') return null;

    root.msg = msg;
    return root;
}

module.exports = {
    parseMsg,
};
