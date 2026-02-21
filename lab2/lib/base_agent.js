'use strict';

const { parseMsg } = require('./msg');
const SoccerSocket = require('./socket');
const { parseSee, parseHear } = require('./perception');
const { hasPoint } = require('./flags');
const { estimatePoseFromFlags } = require('./localization');

function formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1000) / 1000);
}

class BaseAgent {
    constructor({
        teamName,
        version = 7,
        host = '127.0.0.1',
        port = 6000,
        goalie = false,
        role = 'player',
        start = { x: -15, y: 0 },
        debug = false,
        view = { width: 'wide', quality: 'high' },
    }) {
        this.teamName = teamName;
        this.version = version;
        this.host = host;
        this.port = port;
        this.goalie = goalie;
        this.role = role;
        this.start = start;
        this.debug = debug;
        this.view = view;
        this.viewConfigured = false;

        this.socket = new SoccerSocket({ host, port });
        this.side = 'l';
        this.unum = null;
        this.playMode = 'before_kick_off';
        this.run = false;
        this.lastCommandTime = -1;

        this.world = {
            time: 0,
            objects: [],
            flags: [],
            players: [],
            goals: [],
            ball: null,
            pose: null,
            hear: [],
            senseBody: null,
        };

        this._debugSeeSamples = 0;
    }

    startAgent() {
        this.socket.connect((raw) => this.onRawMessage(raw));
        this.socket.init(this.teamName, this.version, this.goalie);
    }

    stopAgent() {
        this.socket.close();
    }

    log(message) {
        const number = this.unum === null ? '?' : this.unum;
        console.log(`[${this.teamName}:${this.role}:${this.side}${number}] ${message}`);
    }

    onRawMessage(raw) {
        if (
            this.debug
            && typeof raw === 'string'
            && raw.startsWith('(see ')
            && this._debugSeeSamples < 5
            && this.teamName === 'teamA'
        ) {
            this._debugSeeSamples += 1;
            this.log(`raw-see ${raw.slice(0, 220)}`);
        }

        const data = parseMsg(raw);
        if (!data) return;

        switch (data.cmd) {
        case 'init':
            this.handleInit(data);
            break;
        case 'hear':
            this.handleHear(data);
            break;
        case 'see':
            this.handleSee(data);
            break;
        case 'sense_body':
            this.handleSenseBody(data);
            break;
        default:
            break;
        }
    }

    handleInit(data) {
        if (!Array.isArray(data.p) || data.p.length < 2) return;
        this.side = typeof data.p[0] === 'string' ? data.p[0] : this.side;
        if (typeof data.p[1] === 'number') this.unum = data.p[1];
        if (typeof data.p[2] === 'string') this.playMode = data.p[2];

        const start = this.resolveStartPosition();
        if (start) {
            this.sendCommand({ n: 'move', v: [start.x, start.y] });
        }
        this.configureView();

        this.onInit(data);
    }

    handleHear(data) {
        const hear = parseHear(data);
        if (!hear) return;

        this.world.hear.push(hear);
        if (this.world.hear.length > 40) {
            this.world.hear.shift();
        }

        if (hear.sender === 'referee') {
            this.playMode = hear.message;
            this.run = hear.message === 'play_on';
            if (hear.message && hear.message.startsWith('goal_')) {
                this.onGoal(hear.message);
            }
        }

        this.onHear(hear);
    }

    handleSenseBody(data) {
        this.world.senseBody = data;
        this.onSenseBody(data);
    }

    handleSee(data) {
        const seen = parseSee(data);
        if (!seen) return;

        this.world.time = seen.time;
        this.world.objects = seen.objects;
        this.world.flags = seen.objects.filter((obj) => (obj.kind === 'flag' || obj.kind === 'goal') && hasPoint(obj.name));
        this.world.players = seen.objects.filter((obj) => obj.kind === 'player');
        this.world.goals = seen.objects.filter((obj) => obj.kind === 'goal');
        this.world.ball = seen.objects.find((obj) => obj.kind === 'ball') || null;

        const pose = estimatePoseFromFlags(this.world.flags, this.world.pose);
        if (pose) {
            this.world.pose = pose;
        }

        this.onSee(this.world);
        const command = this.decide(this.world);
        this.sendCommand(command, seen.time);
    }

    sendCommand(command, time = null) {
        if (!command || typeof command.n !== 'string') return false;
        if (time !== null && time === this.lastCommandTime) return false;

        const message = this.formatCommand(command);
        if (!message) return false;

        this.socket.sendRaw(message);
        if (time !== null) {
            this.lastCommandTime = time;
        }

        if (this.debug) {
            this.log(`cmd ${message}`);
        }
        return true;
    }

    formatCommand(command) {
        const { n, v } = command;
        if (!n) return null;

        if (typeof v === 'undefined' || v === null) {
            return `(${n})`;
        }
        if (Array.isArray(v)) {
            return `(${n} ${v.map(formatNumber).join(' ')})`;
        }
        if (typeof v === 'string') {
            return `(${n} ${v})`;
        }
        return `(${n} ${formatNumber(v)})`;
    }

    latestHear(predicate) {
        for (let i = this.world.hear.length - 1; i >= 0; i -= 1) {
            const msg = this.world.hear[i];
            if (!predicate || predicate(msg)) return msg;
        }
        return null;
    }

    isOwnTeam(player) {
        return !!player && player.team === this.teamName;
    }

    isOpponent(player) {
        return !!player && !!player.team && player.team !== this.teamName;
    }

    ownGoalName() {
        return this.side === 'l' ? 'g l' : 'g r';
    }

    opponentGoalName() {
        return this.side === 'l' ? 'g r' : 'g l';
    }

    resolveStartPosition() {
        if (!this.start || typeof this.start.x !== 'number' || typeof this.start.y !== 'number') {
            return null;
        }
        return {
            x: this.side === 'r' ? -this.start.x : this.start.x,
            y: this.start.y,
        };
    }

    configureView() {
        if (this.viewConfigured || !this.view) return;
        const width = this.view.width || 'wide';
        const quality = this.view.quality || 'high';
        this.sendCommand({ n: 'change_view', v: [width, quality] });
        this.viewConfigured = true;
    }

    moveToStart() {
        const start = this.resolveStartPosition();
        if (!start) return false;
        return this.sendCommand({ n: 'move', v: [start.x, start.y] });
    }

    onInit() {}

    onHear() {}

    onSee() {}

    onSenseBody() {}

    onGoal() {}

    decide() {
        return null;
    }
}

module.exports = BaseAgent;
