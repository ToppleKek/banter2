const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');

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
    const member = msg.guild.members.resolve(args.get('target'));
    const reason = `Kicked by: ${msg.author.tag} - ` + args.get('reason') || `(no reason provided)`;

    if (!member)
        throw new CommandError('ArgumentError', 'This user does not exist in the guild');

    if (!member.kickable)
        throw new CommandError('BotPermissionError', 'This user is not kickable by the bot');

    if (member.roles.highest.rawPosition >= msg.guild.members.resolve(msg.author).roles.highest.rawPosition)
        throw new CommandError('PermissionError', `${member.user.tag} has a higher or equal role`);

    const kick_embed = {
        color: 1571692,
        title: `${member.user.tag} JUST GOT DABBED ON`,
        description: 'GET FRICKED KIDDO',
        thumbnail: {
            url: 'https://topplekek.xyz/breaddab.gif',
        },
        timestamp: new Date(),
    };

    const dm_embed = {
        color: 1571692,
        title: `Get heckin dabbed on from ${msg.guild.name}`,
        description: `They kicked you for \`${args.get('reason')}\``,
        timestamp: new Date(),
    };

    await member.createDM().then((dm_channel) => dm_channel.send({embeds:[dm_embed]}))
        .catch((err) => msg.respond_error(`Warn: failed to DM user: ${err}`));

    member.kick(reason)
        .then(() => msg.channel.send({embeds: [kick_embed]}))
        .catch((err) => msg.respond_error(`API Error: \`\`\`${err}\`\`\``));
};
