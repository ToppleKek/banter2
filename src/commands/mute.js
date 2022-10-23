const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const CommandError = require("../command_error");
const Utils = require("../utils/utils");
const { ms_to_hhmmss, pledge, command_error_if } = require("../utils/utils");

module.exports.help = 'Mute a user';
module.exports.usage = '#PREFIXmute <target> ?<time> ?<reason>';
module.exports.required_permissions = ['MANAGE_ROLES'];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to mute'
    }],
    optional_args: [{
        name: 'time',
        type: 'string',
        description: 'Time to mute'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const [err, member] = await pledge(msg.guild.members.fetch(args.get('target')));
    command_error_if(err, 'APIError');

    if (!member)
        throw new CommandError('ArgumentError', 'User not in guild');

    if (member.isCommunicationDisabled()) {
        const [err] = await pledge(member.timeout(null, `Unmute issued by: ${msg.author.tag}`));
        command_error_if(err, 'APIError');

        msg.respond_info(`Unmuted ${member.user.tag}`);
    } else if (args.get('time')) {
        const time = Utils.parse_time(args.get('time'));

        if (!time)
            throw new CommandError('ArgumentError', 'Invalid time format');
        else {
            const [err] = await pledge(member.timeout(time * 1000, `Timed mute issued by: ${msg.author.tag}`));
            command_error_if(err, 'APIError');

            bot.guilds.get(msg.guild.id).mod_log(`timed mute (${ms_to_hhmmss(time * 1000)})`, msg.author, member.user);
            msg.respond_info(`Muted ${member.user.tag} for ${time} seconds`);
        }
    } else {
        // Indefinite mute
        const [err] = await pledge(member.timeout(2399999999, `Indefinite mute issued by: ${msg.author.tag}`)); // TODO: Get largest timeout possible
        command_error_if(err, 'APIError');

        bot.guilds.get(msg.guild.id).mod_log(`indefinite mute`, msg.author, member.user);
        msg.respond_info(`Muted ${member.user.tag} indefinitely`);
    }
}
