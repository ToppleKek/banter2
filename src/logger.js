const fs = require('fs');

class Logger {
    constructor(file) {
        this.file = file;
    }

    info(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] INF: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[info] failed to write to log file! ${err}`);
        });
    }

    warn(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] WRN: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[warn] failed to write to log file! ${err}`);
        });
    }

    error(msg) {
        const d = new Date().toLocaleTimeString("en-ca", {timeStyle:"medium", hour12:false});
        const txt = `[${d}] ERR: ${msg}`;
        console.log(txt);

        fs.appendFile(this.file, txt + '\n', (err) => {
            if (err)
                console.log(`[error] failed to write to log file! ${err}`);
        });
    }

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

module.exports = Logger;