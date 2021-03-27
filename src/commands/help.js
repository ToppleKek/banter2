const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Display command help list';
module.exports.usage = '#PREFIXhelp';
module.exports.required_permissions = [''];
module.exports.args_list =  {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'page',
        type: 'number',
        description: 'Page number to display'
    }, {
        name: 'cmd',
        type: 'string',
        description: 'Command to get details on'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    bot.logger.debug(`help: got args: ${util.inspect(args)}`);
    const pages = [];
    const cmds = [];

    if (args.get('cmd')) {
        const cmd_name = args.get('cmd');
        const cmd_args = [];
        const cmd = bot.commands[cmd_name];

        if (!cmd)
            return msg.respond_command_error('Argument Error', 'Command not found');

        for (const arg of cmd.args_list.args) {
            cmd_args.push({
                name: `${arg.name} (${arg.type})`,
                value: arg.description,
                inline: false
            });
        }

        for (const arg of cmd.args_list.optional_args) {
            cmd_args.push({
                name: `(optional) ${arg.name} (${arg.type})`,
                value: arg.description,
                inline: false
            });
        }

        const embed = {
            title: `**${bot.prefix}${cmd_name}**`,
            description: `${cmd.help}\n**Usage**\n${cmd.usage.replace('#PREFIX', bot.prefix)}
            **Permission required**\n${cmd.permission === '' ? 'none' : cmd.permission}`,
            fields: cmd_args,
            color: Math.floor(Math.random() * 0xFFFFFF)
        };

        msg.channel.send({embed});
        return;
    }

    for (const command in bot.commands) {
        cmds.push({
            name: `${bot.prefix}${command}`,
            value: `${bot.commands[command].help}`,
            inline: false
        });
    }

    while (cmds.length)
        pages.push(cmds.splice(0, 10));

    const page = args.get('page') || 0;
    if (page >= pages.length)
        return msg.respond_command_error('Argument Error', 'Page not found');
    msg.channel.send({embed: {
        author: {
            name: msg.author.username,
            iconURL: msg.author.displayAvatarURL()
        },
        color: Math.floor(Math.random() * 0xFFFFFF),
        title: 'Banter3',
        description: `For details, use ${bot.prefix}help <cmd> change pages with ${bot.prefix}help <#>`,
        fields: pages[args.get('page') || 0]
    }});
}
