const fs = require('fs');

const L = {
    file: `./logs/${Date.now()}_LOG.txt`,

    _line_and_filename() {
        // const err = new Error();
        const line = new Error().stack.split('\n')[3].trim();
        let split = line.split('/');

        if (split.length === 1)
            split = line.split('\\'); // Windows

        return split[split.length - 1].replace(/\(|\)/g, '');
    },

    info(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] (${this._line_and_filename()}) INF: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[info] failed to write to log file! ${err}`);
        });
    },

    warn(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] (stack trace follows) WRN: ${msg}\n${new Error().stack}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[warn] failed to write to log file! ${err}`);
        });
    },

    error(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] (stack trace follows) ERR: ${msg}\n${new Error().stack}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[error] failed to write to log file! ${err}`);
        });
    },

    debug(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] (${this._line_and_filename()}) DBG: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[debug] failed to write to log file! ${err}`);
        });
    }
}

const Logger = {
    info: L.info.bind(L),
    warn: L.warn.bind(L),
    error: L.error.bind(L),
    debug: L.debug.bind(L),
}

module.exports = Logger;
