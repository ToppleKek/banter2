const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, parse_time, command_error_if } = require('../utils/utils');

module.exports.help = 'Temporarily ban a member from the guild';
module.exports.usage = '#PREFIXtempnaenae <target> <length> <?reason>';
module.exports.required_permissions = ['BAN_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to temp ban'
    }, {
        name: 'length',
        type: 'string',
        description: 'A length time string'
    }],
    optional_args: [{
        name: 'reason',
        type: 'string',
        description: 'A reason for the temp ban'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    let err, member;
    [err, member] = await pledge(msg.guild.members.fetch(args.get('target')));

    let length = parse_time(args.get('length'));

    if (!length)
        throw new CommandError('ArgumentError', `Invalid time string: ${args.get('length')}`);

    const length_display = `<t:${Math.floor(Date.now() / 1000) + length}>`;
    length *= 1000;

    const opts = {
        deleteMessageSeconds: 0,
        reason: `Temp ban for ${length}ms issued by: ${msg.author.tag} - ${args.get('reason') || '(no reason provided)'}`
    };

    if (err) {
        const ban_embed = {
            color: 1571692,
            title: `${args.get('target').tag} JUST GOT TEMP HACKNAENAED UNTIL ${length_display}`,
            description: 'GET FRICKED KIDDO',
            thumbnail: {
                url: 'https://topplekek.xyz/lmao.gif',
            },
            timestamp: new Date().toISOString(),
        };

        const [err] = await pledge(bot.guilds.get(msg.guild.id).temp_ban(args.get('target'), msg.author, length, opts.deleteMessageSeconds, opts.reason));
        command_error_if(err, 'InternalError');
        msg.respond({embeds:[ban_embed]});
        return;
    }

    if (!member.bannable)
        throw new CommandError('BotPermissionError', 'This user is not bannable by the bot');

    if (member.roles.highest.rawPosition >= msg.guild.members.resolve(msg.author).roles.highest.rawPosition)
        throw new CommandError('PermissionError', `${member.user.tag} has a higher or equal role`);

    const ban_embed = {
        color: 1571692,
        title: `${member.user.tag} JUST GOT TEMPNAENAED UNTIL ${length_display}`,
        description: 'GET FRICKED KIDDO',
        thumbnail: {
            url: 'https://topplekek.xyz/lmao.gif',
        },
        timestamp: new Date().toISOString(),
    };

    const dm_embed = {
        color: 1571692,
        title: `Get heckin tempnaenaed from ${msg.guild.name}`,
        description: `They banned you for \`${args.get('reason') || '(no reason provided)'}\`\n\nYou will be unbanned on ${length_display}`,
        timestamp: new Date().toISOString(),
    };

    await member.createDM().then((dm_channel) => dm_channel.send({embeds:[dm_embed]}))
        .catch((err) => msg.respond_error(`Warn: failed to DM user: ${err}`));

    [err] = await pledge(bot.guilds.get(msg.guild.id).temp_ban(args.get('target'), msg.author, length, opts.deleteMessageSeconds, opts.reason));
    command_error_if(err, 'InternalError');

    await pledge(msg.respond({embeds: [ban_embed]}));
}
