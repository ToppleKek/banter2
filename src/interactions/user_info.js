const { guilds_shared_with, elide } = require('../utils/utils');

module.exports.name = 'Get info';
module.exports.type = 2;
module.exports.required_permissions = [];

/**
 * @param {Bot} bot Bot object that called
 * @param {import('discord.js').GuildMember} executor The member who executed this interaction
 * @param {import('discord.js').Message} target_member The member this interaction was executed on
 * @param {Object} interaction The interaction
 */
module.exports.main = async (bot, executor, target_member, interaction) => {
    const default_client_status = {
        desktop: 'unknown',
        web: 'unknown',
        mobile: 'unknown',
    };
    const client_status = target_member?.presence?.clientStatus ?? default_client_status;

    const embed = {
        author:  {
            name: `${target_member.user.tag}`,
            iconURL: target_member.user.avatarURL({ size: 2048, dynamic: true, format: 'png' }),
        },
        description: target_member.nickname ? `AKA: ${target_member.nickname} (${target_member.user.id})` : `(${target_member.user.id})`,
        fields: [{
            name: 'Status',
            value: `Desktop: ${client_status.desktop || 'offline'}\nWeb: ${client_status.web || 'offline'}\nMobile: ${client_status.mobile || 'offline'}`
        }, {
            name: 'Account Created At',
            value: `<t:${Math.floor(target_member.user.createdTimestamp / 1000)}>`,
        }, {
            name: 'Joined Server At',
            value: `${target_member.joinedTimestamp ? `<t:${Math.floor(target_member.joinedTimestamp / 1000)}>` : 'N/A'}`,
        }, {
            name: 'Seen On',
            value: elide(guilds_shared_with(bot, target_member.user).map((guild) => guild.name).join('\n'), 500) || 'Nowhere',
        }],
        color: target_member?.roles?.color?.color,
    };

    interaction.respond({
        type: 4,
        data: {
            embeds: [embed],
            flags: 1 << 6
        }
    });
}
