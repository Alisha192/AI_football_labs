/*
 * Парсер сообщений симулятора: разбираю строковые пакеты в удобную структуру для логики агента.
 */

//     Рекурсивный парсер протокола сообщений rcssserver.
module.exports = {
    //     Запускаю разбор сырой строки сообщения в объектную структуру.
    parseMsg(msg) {
        // Разбор сообщения
        if (msg.endsWith('\u0000'))
            // Удаление символа в конце
            msg = msg.substring(0, msg.length - '\u0000'.length);
        // Разбор сообщения
        let array = msg.match(/(\(|[-\d.]+|[\\"\w]+|\))/g);
        let res = {msg, p: []}; // Результирующее сообщение
        // Анализировать с индекса 0, результат в res
        this.parse(array, {idx: 0}, res);
        this.makeCmd(res); // Выделить команду
        return res;
    },
    //     Разбираю один блок в скобках и передаю управление внутрь.
    parse(array, index, res) {
        // Разбор сообщения в скобках
        // Всегда с открывающей скобки
        if (array[index.idx] !== '(') return;
        index.idx++;
        // Разбор внутри скобок
        this.parseInner(array, index, res);
    },
    //     Рекурсивно извлекаю вложенные элементы до закрывающей скобки.
    parseInner(array, index, res) {
        // Пока не встретится закрывающая скобка
        while (array[index.idx] !== ')') {
            // Если внутри еще одна скобка
            if (array[index.idx] === '(') {
                let r = {p: []};
                // Рекурсивный вызов с index
                this.parse(array, index, r);
                res.p.push(r);
            } else {
                // Одиночный параметр
                let num = parseFloat(array[index.idx]);
                res.p.push(isNaN(num) ? array[index.idx] : num);
                index.idx++;
            }
        }
        index.idx++;
    },
    //     Выношу имя команды в поле cmd для удобной обработки.
    makeCmd(res) {
        // Выделение команды
        if (res.p && res.p.length > 0) {
            // Первый параметр — команда
            res.cmd = res.p.shift();
            // Выделить команды у параметров
            for (let value of res.p) this.makeCmd(value);
        }
    },
};
