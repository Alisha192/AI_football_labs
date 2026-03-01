/*
 * UDP-обвязка для агента: открываю сокет, отправляю init и передаю игровые команды на rcssserver.
 */

const dgram = require('dgram');

//     Поднимаю UDP-клиент, привязываю его к агенту и выполняю init в симуляторе.
module.exports = async (agent, teamName, version, goalie) => {
    //     Создаю UDP-сокет клиента для обмена сообщениями с симулятором.
    const socket = dgram.createSocket({type: 'udp4', reuseAddr: true});

    //     Передаю сокет в агент, чтобы он мог отправлять команды сам.
    agent.setSocket(socket);

    //     Все входящие пакеты сразу пробрасываю в обработчик агента.
    socket.on('message', (msg, info) => {
        agent.msgGot(msg);
    });

    //     Делаю promise-обёртку для удобного await при отправке.
    socket.sendMsg = (msg) => {
        return new Promise((resolve, reject) => {
            socket.send(Buffer.from(msg), 6000, 'localhost', (err, bytes) => {
                //console.log(msg);
                if (err) reject(err);
                resolve(bytes);
            });
        });
    };
    console.log("goalie", goalie);
    if (!goalie){
        //     Отправляю init-команду и регистрирую игрока в сервере.
        await socket.sendMsg(`(init ${teamName} (version ${version}))`);    
    } else {
        console.log("yesYES");
    //     Отправляю init-команду и регистрирую игрока в сервере.
        await socket.sendMsg(`(init ${teamName} (version ${version}) (goalie))`);
    }
    
};
