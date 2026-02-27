/**
 * @module lab6/socket.js
 * UDP-транспорт для обмена командами и сенсорными событиями с сервером симуляции.
 */

const dgram = require('dgram');

module.exports = async (agent, teamName, version, goalie, options = {}) => {
    const host = typeof options.host === 'string' ? options.host : '127.0.0.1';
    const rawPort = Number(options.port);
    const port = Number.isFinite(rawPort) ? rawPort : 6000;
    const socket = dgram.createSocket({type: 'udp4', reuseAddr: true});

    agent.setSocket(socket);

    socket.on('message', (msg, info) => {
        agent.msgGot(msg);
    });

    socket.on('error', (err) => {
        // Не падаем молча: при ошибках сокета сразу видно причину в логе.
        console.error('[socket] error:', err.message);
    });

    socket.sendMsg = (msg) => {
        return new Promise((resolve, reject) => {
            socket.send(Buffer.from(msg), port, host, (err, bytes) => {
                if (err) reject(err);
                resolve(bytes);
            });
        });
    };

    if (!goalie){
        await socket.sendMsg(`(init ${teamName} (version ${version}))`);    
    } else {
        await socket.sendMsg(`(init ${teamName} (version ${version}) (goalie))`);
    }
    
};
