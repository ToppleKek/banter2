const fs = require('fs');

const L = {
    file: `./logs/${Date.now()}_LOG.txt`,

    info(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] INF: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[info] failed to write to log file! ${err}`);
        });
    },

    warn(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] WRN: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[warn] failed to write to log file! ${err}`);
        });
    },

    error(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] ERR: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[error] failed to write to log file! ${err}`);
        });
    },

    debug(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] DBG: ${msg}`;
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