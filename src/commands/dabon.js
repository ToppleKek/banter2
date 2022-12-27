const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge } = require('../utils/utils');

module.exports.help = 'Kick a member from the guild';
module.exports.usage = '#dabon <target> <?reason>';
module.exports.required_permissions = ['KICK_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to kick'
    }],
    optional_args: [{
        name: 'reason',
        type: 'string',
        description: 'A reason for the kick'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    let err, member, author;
    [err, member] = await pledge(msg.guild.members.fetch(args.get('target')));
    [err, author] = await pledge(msg.guild.members.fetch(msg.author));
    const reason = `Kicked by: ${msg.author.tag} - ` + args.get('reason') || `(no reason provided)`;

    if (!member)
        throw new CommandError('ArgumentError', 'This user does not exist in the guild');

    if (!member.kickable)
        throw new CommandError('BotPermissionError', 'This user is not kickable by the bot');

    if (member.roles.highest.rawPosition >= author.roles.highest.rawPosition)
        throw new CommandError('PermissionError', `${member.user.tag} has a higher or equal role`);

    const kick_embed = {
        color: 1571692,
        title: `${member.user.tag} JUST GOT DABBED ON`,
        description: 'GET FRICKED KIDDO',
        thumbnail: {
            url: 'https://topplekek.xyz/breaddab.gif',
        },
        timestamp: new Date().toISOString(),
    };

    const dm_embed = {
        color: 1571692,
        title: `Get heckin dabbed on from ${msg.guild.name}`,
        description: `They kicked you for \`${args.get('reason')}\``,
        timestamp: new Date().toISOString(),
    };

    await member.createDM().then((dm_channel) => dm_channel.send({embeds:[dm_embed]}))
        .catch((err) => msg.respond_error(`Warn: failed to DM user: ${err}`));

    member.kick(reason)
        .then(() => msg.respond({embeds: [kick_embed]}))
        .catch((err) => msg.respond_error(`API Error: \`\`\`${err}\`\`\``));

    bot.guilds.get(msg.guild.id).mod_log('dabon (kick)', msg.author, member.user, args.get('reason'));
};
