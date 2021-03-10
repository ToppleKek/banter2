class CommandError extends Error {
    constructor(type, msg) {
        super(msg);

        this.type = type;
        this.msg = msg;
    }
}

module.exports = CommandError;