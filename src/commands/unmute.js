const { Message } = require("discord.js");
const Bot = require("../bot");
const CommandError = require("../command_error");
const { ms_to_hhmmss, pledge, command_error_if, parse_time } = require("../utils/utils");

module.exports.help = 'Unmute a user';
module.exports.usage = '#PREFIXunmute <target>';
module.exports.required_permissions = ['MODERATE_MEMBERS'];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to unmute'
    }],
    optional_args: []
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
        const [errs] = await pledge([
            member.timeout(null, `Unmute issued by: ${msg.author.tag}`),
            bot.guilds.get(msg.guild.id).mod_log('unmute', msg.author, member.user)
        ]);
        command_error_if(errs, 'APIError');

        msg.respond_info(`Unmuted ${member.user.tag}`);
    } else
        msg.respond_error(`${member.user.tag} is not muted.`);
};
