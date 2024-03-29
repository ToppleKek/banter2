const { Message } = require("discord.js");
const Bot = require("../bot");
const Logger = require("../logger");
const { pledge, guilds_shared_with, elide } = require("../utils/utils");

module.exports.help = 'Get info about a user';
module.exports.usage = '#PREFIXinfo <user>';
module.exports.required_permissions = [];
module.exports.args_list =  {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'user',
        type: 'user',
        description: 'The user to probe'
    }]
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
        member = {user};

    const default_client_status = {
        desktop: 'unknown',
        web: 'unknown',
        mobile: 'unknown',
    };
    const client_status = member?.presence?.clientStatus ?? default_client_status;

    const embed = {
        author:  {
            name: `${user.displayName} (${user.tag})`,
            iconURL: user.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' }),
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
            value: elide((await guilds_shared_with(bot, user)).map((guild) => guild.name).join('\n'), 500) || 'Nowhere',
        }],
        color: member?.roles?.color?.color,
        thumbnail: {
            url: member.user.displayAvatarURL({ size: 4096, dynamic: true, format: 'png' })
        }
    };

    msg.respond({embeds: [embed]});
}
