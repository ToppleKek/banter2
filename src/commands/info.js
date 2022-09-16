const { Message } = require("discord.js");
const Bot = require("../bot");
const Logger = require("../logger");
const { pledge, guilds_shared_with } = require("../utils/utils");

module.exports.help = 'Get info about a user';
module.exports.usage = '#PREFIXinfo <user>';
module.exports.required_permissions = [];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'user',
        type: 'user',
        description: 'The user to probe'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const user = args.get('user') || msg.author;
    let [err, member] = await pledge(msg.guild.members.fetch(user.id));

    if (err)
        member = {};

    const default_client_status = {
        desktop: 'unknown',
        web: 'unknown',
        mobile: 'unknown',
    };
    const client_status = member?.presence?.clientStatus ?? default_client_status;

    const embed = {
        author:  {
            name: `${user.tag}`,
            iconURL: user.avatarURL({ size: 2048, dynamic: true, format: 'png' }),
        },
        description: member.nickname ? `AKA: ${member.nickname} (${user.id})` : `(${user.id})`,
        fields: [{
            name: 'Status',
            value: `Desktop: ${client_status.desktop || 'offline'}\nWeb: ${client_status.web || 'offline'}\nMobile: ${client_status.mobile || 'offline'}`
        }, {
            name: 'Account Created At',
            value: `<t:${Math.floor(user.createdTimestamp / 1000)}>`,
        }, {
            name: 'Joined Server At',
            value: `${member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}>` : 'N/A'}`,
        }, {
            name: 'Seen On',
            value: guilds_shared_with(bot, user).map((guild) => guild.name).join('\n') || 'Nowhere',
        }],
        color: member?.roles?.color,
    };

    msg.channel.send({embeds: [embed]});
}
