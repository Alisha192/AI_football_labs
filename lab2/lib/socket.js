'use strict';

const dgram = require('dgram');

class SoccerSocket {
    constructor({ host = '127.0.0.1', port = 6000 } = {}) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.onMessage = null;
    }

    connect(onMessage) {
        this.onMessage = onMessage;
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.socket.on('message', (msg) => {
            if (this.onMessage) {
                this.onMessage(msg.toString('utf8'));
            }
        });
        this.socket.on('error', (err) => {
            console.error('[socket] error:', err.message);
        });
    }

    sendRaw(command) {
        if (!this.socket) return;
        const payload = Buffer.from(command);
        this.socket.send(payload, this.port, this.host, (err) => {
            if (err) {
                console.error('[socket] send error:', err.message);
            }
        });
    }

    init(teamName, version = 7, goalie = false) {
        const goalieArg = goalie ? ' (goalie)' : '';
        this.sendRaw(`(init ${teamName} (version ${version})${goalieArg})`);
    }

    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

module.exports = SoccerSocket;
