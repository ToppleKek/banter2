const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Display command help list';
module.exports.usage = '#PREFIXhelp';
module.exports.args_list =  {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'cmd',
        types: ['string'],
    }, {
        name: 'page',
        types: ['number']
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Array} args Array of arguments 
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    bot.logger.debug(`help: got args: ${util.inspect(args)}`);
    const pages = [];
    const cmds = [];

    for (const command in bot.commands) {
        cmds.push({
            name: `${bot.prefix}${command}`,
            value: `${bot.commands[command].help}`,
            inline: false
        });
    }

    while (cmds.length)
        pages.push(cmds.splice(0, 10));

    msg.channel.send({embed: {
        author: {
            name: msg.author.username,
            iconURL: msg.author.displayAvatarURL()
        },
        color: 0xAA00FF,
        title: 'Banter3',
        description: `For details, use ${bot.prefix}help <cmd>`,
        fields: pages[0]
    }});
}
