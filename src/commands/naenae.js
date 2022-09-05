const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');

module.exports.help = 'Ban a member from the guild';
module.exports.usage = '#PREFIXnaenae <target> <?days> <?reason>';
module.exports.required_permissions = ['BAN_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to ban'
    }],
    optional_args: [{
        name: 'days',
        type: 'number',
        description: 'The number of days worth of messages to delete (default=7)'
    }, {
        name: 'reason',
        type: 'string',
        description: 'A reason for the ban'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const member = msg.guild.members.resolve(args.get('target'));
    const opts = {
        deleteMessageDays: args.get('days') ?? 7,
        reason: `Ban issued by: ${msg.author.tag} - ` + args.get('reason') || `(no reason provided)`
    };

    if (!member) {
        const ban_embed = {
            color: 1571692,
            title: `${args.get('target').tag} JUST GOT HACKNAENAED`,
            description: 'GET FRICKED KIDDO',
            thumbnail: {
                url: 'https://topplekek.xyz/lmao.gif',
            },
            timestamp: new Date().toISOString(),
        };

        msg.guild.bans.create(args.get('target'), opts)
            .then(() => msg.channel.send({embeds:[ban_embed]}))
            .catch((err) => msg.respond_error(`API Error: \`\`\`${err}\`\`\``));

        return;
    }

    if (!member.bannable)
        throw new CommandError('BotPermissionError', 'This user is not bannable by the bot');

    if (member.roles.highest.rawPosition >= msg.guild.members.resolve(msg.author).roles.highest.rawPosition)
        throw new CommandError('PermissionError', `${member.user.tag} has a higher or equal role`);

    const ban_embed = {
        color: 1571692,
        title: `${member.user.tag} JUST GOT NAENAED`,
        description: 'GET FRICKED KIDDO',
        thumbnail: {
            url: 'https://topplekek.xyz/lmao.gif',
        },
        timestamp: new Date().toISOString(),
    };

    const dm_embed = {
        color: 1571692,
        title: `Get heckin naenaed from ${msg.guild.name}`,
        description: `They banned you for \`${args.get('reason')}\``,
        timestamp: new Date().toISOString(),
    };

    await member.createDM().then((dm_channel) => dm_channel.send({embeds:[dm_embed]}))
        .catch((err) => msg.respond_error(`Warn: failed to DM user: ${err}`));

    member.ban(opts)
        .then(() => msg.channel.send({embeds: [ban_embed]}))
        .catch((err) => msg.respond_error(`API Error: \`\`\`${err}\`\`\``));
};
