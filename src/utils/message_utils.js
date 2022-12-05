const Logger = require("../logger");

module.exports = {
    respond: function (data) {
        return this.channel.send(data);
    },

    respond_info: function (msg, header) {
        this.respond({embeds: [{
            color: 0x259EF5,
            title: header,
            description: msg,
        }]});
    },

    respond_command_error: function (type, msg) {
        if (!type || !msg) {
            Logger.error(`respond_command_error called with null parameters! type=${type} msg=${msg}`);
            return;
        }

        const fields = [{
            name: 'Type',
            value: type,
            inline: false
        }, {
            name: 'Details',
            value: msg,
            inline: false
        }];

        if (msg.command) {
            fields.push({
                name: 'Usage',
                value: this.command.usage,
                inline: false
            });
        }

        this.respond({embeds: [{
            author: {
                name: `Command executed by ${this.author.username}#${this.author.discriminator}`,
                iconURL: this.author.displayAvatarURL()
            },
            title: 'Command Error',
            fields,
            color: 0xFF6640,
            timestamp: new Date().toISOString()
        }]});
    },

    respond_error: function (msg) {
        this.respond({embeds: [{
            color: 0xFF6640,
            description: msg,
        }]});
    }
};
