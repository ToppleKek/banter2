const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge } = require('../utils/utils');

module.exports.help = 'Unban a member from the guild';
module.exports.usage = '#PREFIXwhip <target> <?reason>';
module.exports.required_permissions = ['BAN_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to unban'
    }],
    optional_args: [{
        name: 'reason',
        type: 'string',
        description: 'A reason for the unban'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const target = args.get('target');
    const e = {
        color: 1571692,
        title: `${target.tag} JUST GOT WHIPPED`,
        description: 'WELCOME BACK KIDDO',
        thumbnail: {
            url: 'https://topplekek.xyz/lmao.gif',
        },
        timestamp: new Date().toISOString(),
    };

    const [err] = await pledge(msg.guild.bans.remove(target, args.get('reason') ?? 'No reason provided'));

    if (err)
        throw new CommandError('APIError', err.toString());
    else {
        msg.respond({embeds:[e]});
        bot.guilds.get(msg.guild.id).mod_log('whip (unban)', msg.author, target);
    }
};
