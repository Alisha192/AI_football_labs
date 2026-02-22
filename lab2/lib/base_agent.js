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
        poseLossTicks = 8,
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
        this.poseLossTicks = Math.max(1, Math.floor(poseLossTicks));
        this.poseMissingTicks = 0;
        this.queuedSideCommands = [];

        this.world = {
            time: 0,
            objects: [],
            flags: [],
            players: [],
            goals: [],
            ball: null,
            pose: null,
            poseReliable: false,
            hear: [],
            senseBody: null,
            stamina: null,
            effort: null,
            recovery: null,
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
            this.run = ['play_on', 'kick_off_l', 'kick_off_r'].includes(hear.message);
            if (hear.message && hear.message.startsWith('goal_')) {
                this.onGoal(hear.message);
            }
        }

        this.onHear(hear);
    }

    handleSenseBody(data) {
        this.world.senseBody = data;
        const staminaState = this.extractStamina(data);
        if (staminaState) {
            this.world.stamina = staminaState.stamina;
            this.world.effort = staminaState.effort;
            this.world.recovery = staminaState.recovery;
        }
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

        const previousPose = this.world.pose && this.world.pose.reliable !== false ? this.world.pose : null;
        const pose = estimatePoseFromFlags(this.world.flags, previousPose);
        if (pose) {
            this.poseMissingTicks = 0;
            this.world.pose = {
                ...pose,
                reliable: true,
                lostTicks: 0,
                lastSeenTime: seen.time,
            };
            this.world.poseReliable = true;
        } else {
            this.poseMissingTicks += 1;
            this.world.poseReliable = false;

            if (this.world.pose) {
                this.world.pose = {
                    ...this.world.pose,
                    reliable: false,
                    lostTicks: this.poseMissingTicks,
                };
            }

            if (this.poseMissingTicks >= this.poseLossTicks) {
                this.world.pose = null;
            }
        }

        this.onSee(this.world);
        let command = this.decide(this.world);
        if (command && command.n === 'say') {
            this.queueAuxCommand(command);
            command = null;
        }

        this.sendCommand(command, seen.time, { trackTick: true });
        this.flushQueuedCommands(seen.time);
    }

    sendCommand(command, time = null, { trackTick = true } = {}) {
        if (!command || typeof command.n !== 'string') return false;
        if (trackTick && time !== null && time === this.lastCommandTime) return false;

        const limitedCommand = this.limitCommandByStamina(command);
        const message = this.formatCommand(limitedCommand);
        if (!message) return false;

        this.socket.sendRaw(message);
        if (trackTick && time !== null) {
            this.lastCommandTime = time;
        }

        if (this.debug) {
            this.log(`cmd ${message}`);
        }
        return true;
    }

    extractStamina(senseBody) {
        if (!senseBody || !Array.isArray(senseBody.p)) return null;
        for (const item of senseBody.p) {
            if (!item || typeof item !== 'object') continue;
            if (item.cmd !== 'stamina' || !Array.isArray(item.p)) continue;

            const stamina = typeof item.p[0] === 'number' ? item.p[0] : null;
            const effort = typeof item.p[1] === 'number' ? item.p[1] : null;
            const recovery = typeof item.p[2] === 'number' ? item.p[2] : null;
            return { stamina, effort, recovery };
        }
        return null;
    }

    limitCommandByStamina(command) {
        if (!command || command.n !== 'dash') return command;
        if (typeof this.world.stamina !== 'number' || this.world.stamina >= 2500) {
            return command;
        }

        const limitDashPower = (power) => {
            if (typeof power !== 'number' || !Number.isFinite(power)) return power;
            if (power > 40) return 40;
            if (power < -40) return -40;
            return power;
        };

        if (typeof command.v === 'number') {
            const limited = limitDashPower(command.v);
            if (limited === command.v) return command;
            return { ...command, v: limited };
        }

        if (Array.isArray(command.v) && command.v.length > 0) {
            const limited = limitDashPower(command.v[0]);
            if (limited === command.v[0]) return command;
            return { ...command, v: [limited, ...command.v.slice(1)] };
        }

        return command;
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
            if (n === 'say') {
                const quoted = v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"';
                const payload = quoted
                    ? v
                    : `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
                return `(${n} ${payload})`;
            }
            return `(${n} ${v})`;
        }
        return `(${n} ${formatNumber(v)})`;
    }

    queueAuxCommand(command) {
        if (!command || typeof command.n !== 'string') return false;
        this.queuedSideCommands.push(command);
        if (this.queuedSideCommands.length > 4) {
            this.queuedSideCommands.shift();
        }
        return true;
    }

    queueSay(message) {
        if (typeof message !== 'string') return false;
        const text = message.trim();
        if (!text) return false;
        return this.queueAuxCommand({ n: 'say', v: text });
    }

    flushQueuedCommands(time) {
        if (!this.queuedSideCommands.length) return;
        const queue = this.queuedSideCommands.splice(0, this.queuedSideCommands.length);
        for (const command of queue) {
            this.sendCommand(command, time, { trackTick: false });
        }
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
