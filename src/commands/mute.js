const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const CommandError = require("../command_error");
const Utils = require("../utils/utils");

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
    const member = msg.guild.members.resolve(args.get('target'));

    if (!member)
        throw new CommandError('ArugmentError', 'User not in guild');

    if (member.isCommunicationDisabled()) {
        member.timeout(0, `Unmute issued by: ${msg.author.tag}`);
        msg.respond_info(`Unmuted ${member.tag}`);
    } else if (args.get('time')) {
        const time = Utils.parse_time(args.get('time'));

        if (!time)
            throw new CommandError('ArgumentError', 'Invalid time format');
        else {
            member.timeout(time * 1000, `Timed mute issued by: ${msg.author.tag}`);
            msg.respond_info(`Muted ${member.user.tag} for ${time} seconds`);
        }
    } else {
        // Indefinite mute
        member.timeout(99999999, `Indefinite mute issued by: ${msg.author.tag}`); // TODO: Get largest timeout possible
        msg.respond_info(`Muted ${member.user.tag} indefinitely`);
    }
}
