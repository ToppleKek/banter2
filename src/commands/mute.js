const { Message } = require("discord.js");
const Bot = require("../bot");
const CommandError = require("../command_error");
const { ms_to_hhmmss, pledge, command_error_if, parse_time } = require("../utils/utils");

module.exports.help = 'Mute a user';
module.exports.usage = '#PREFIXmute <target> ?<time> ?<reason>';
module.exports.required_permissions = ['MODERATE_MEMBERS'];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to mute'
    }],
    optional_args: [{
        name: 'time',
        type: 'word',
        description: 'Time to mute'
    }, {
        name: 'reason',
        type: 'string',
        description: 'A reason to mute'
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

    let reason = args.get('reason') ?? 'No reason provided';

    const indefinite_mute = async () => {
        const [err] = await pledge(member.timeout(2399999999, `Indefinite mute issued by: ${msg.author.tag} - ${reason}`));
        command_error_if(err, 'APIError');

        bot.guilds.get(msg.guild.id).mod_log(`indefinite mute`, msg.author, member.user, reason);
        msg.respond_info(`Muted ${member.user.tag} indefinitely - \`${reason}\``);
    };

    if (!member)
        throw new CommandError('ArgumentError', 'User not in guild');

    if (member.isCommunicationDisabled()) {
        const [errs] = await pledge([
            member.timeout(null, `Unmute issued by: ${msg.author.tag}`),
            bot.guilds.get(msg.guild.id).mod_log('unmute', msg.author, member.user)
        ]);
        command_error_if(errs, 'APIError');

        msg.respond_info(`Unmuted ${member.user.tag}`);
    } else if (args.get('time')) {
        const time = parse_time(args.get('time'));

        // HACK: If the time string is invalid, then they **most likely** want an indefinite mute with reason
        if (!time) {
            reason = args.get('time') + (args.get('reason') != null ? ` ${args.get('reason')}` : '');
            await indefinite_mute();
        } else {
            const [err] = await pledge(member.timeout(time * 1000, `Timed mute issued by: ${msg.author.tag} - ${reason}`));
            command_error_if(err, 'APIError');

            bot.guilds.get(msg.guild.id).mod_log(`timed mute (${ms_to_hhmmss(time * 1000)})`, msg.author, member.user, reason);
            msg.respond_info(`Muted ${member.user.tag} for ${ms_to_hhmmss(time * 1000)} - \`${reason}\``);
        }
    } else
        await indefinite_mute();
}
