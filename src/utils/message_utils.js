module.exports = {
    respond_info: function (msg, header) {
        this.channel.send({embeds: [{
            color: 0x259EF5,
            title: header,
            description: msg,
        }]});
    },

    respond_command_error: function (type, msg) {
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

        this.channel.send({embeds: [{
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
        this.channel.send({embeds: [{
            color: 0xFF6640,
            description: msg,
        }]});
    }
};
