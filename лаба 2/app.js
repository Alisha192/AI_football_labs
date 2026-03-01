/*
 * Точка входа лабы: здесь я создаю игроков, подключаю их к серверу и задаю стартовые позиции.
 */

const readline = require('readline');
const Agent = require('./agent');
const Socket = require('./socket');
const Controller = require('./controller');
const VERSION = 7;

//   Основной сценарий лабы: поднимаю агентов, подключаю к серверу и расставляю на поле.
(async () => {
    let playerCords1, playerCords2, rotationSpeed;

    //   Для интерактивных лаб читаю начальные параметры из консоли.
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const it = rl[Symbol.asyncIterator]();

    console.log('Enter first player coords (x,y):');
    playerCords1 = (await it.next()).value.split(' ').map((a) => +a);
    rl.close();

    let controller = new Controller([{act: "flag", fl: "frb"}, {act: 'flag', fl: "gl"}, {act: 'flag', fl: "fc"}, {act: 'kick', fl: "b", goal: "gr"}]);
    let player1 = new Agent('A', controller);
    //   Подключаю агентов к rcssserver и сразу отправляю стартовые команды move.
    await Socket(player1, 'A', VERSION);

    await player1.socketSend('move', `${playerCords1[0]} ${playerCords1[1]}`)
})();
