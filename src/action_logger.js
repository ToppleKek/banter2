const Logger = require('./logger');
const Util = require('./utils/utils');
const Diff = require('diff');

const ActionLogger = {
    userUpdate(bot, old_user, new_user) {
        Util.guilds_shared_with(bot, new_user).each((guild) => {
            const bguild = bot.guilds.get(guild.id);
            if (old_user.tag !== new_user.tag) {
                bguild.log({
                    title: 'User updated',
                    description: `${old_user.tag} --> ${new_user.tag}`
                });
            }
        });
    },

    banter_guildMemberAdd(bot, member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: '✅ Member joined',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
            fields: [{
                name: 'Account Creation Date',
                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}>`
            }, {
                name: 'Invite Used',
                value: member.invite_code || 'Unknown',
            }],
        });
    },

    guildMemberRemove(bot, member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: '❌ Member left',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
        });
    },

    async guildBanAdd(bot, ban) {
        const bguild = bot.guilds.get(ban.guild.id);
        ban = await ban.fetch();

        bguild.log({
            title: '⛔ Member banned',
            description: `${ban.user.tag} (${ban.user.id})\n\n**Reason:** ${ban.reason || 'No reason provided'}`,
            color: 0xBA211C
        });
    },

    async guildBanRemove(bot, ban) {
        const bguild = bot.guilds.get(ban.guild.id);
        ban = await ban.fetch();

        bguild.log({
            title: '✅ Member unbanned',
            description: `${ban.user.tag} (${ban.user.id})\n\n**Original ban reason:** ${ban.reason || 'No reason provided'}`,
            color: 0xBA211C
        });
    },

    guildMemberUpdate(bot, old_member, new_member) {
        const bguild = bot.guilds.get(new_member.guild.id);

        if (old_member.nickname !== new_member.nickname) {
            bguild.log({
                title: 'Member nickname changed',
                description: `${new_member.user.tag} (${new_member.id})\n\n${old_member.nickname} --> ${new_member.nickname}`
            });
        }

        const role_diff = old_member.roles.cache.difference(new_member.roles.cache);
        const old_roles = old_member.roles.cache.map((role) => role.name).join(', ');
        const new_roles = new_member.roles.cache.map((role) => role.name).join(', ');

        if (role_diff.size > 0) {
            bguild.log({
                title: 'Member roles changed',
                description: `Old: ${old_roles}\nNew:${new_roles}`
            });
        }
    },

    channelCreate(bot, channel) {
        if (!channel.guild) // Ignore DM's
            return;

        const bguild = bot.guilds.get(channel.guild.id);

        bguild.log({
            title: '✅ Channel created',
            color: 0xFFFFFF,
            fields: [{
                name: 'Name',
                value: channel.name
            }, {
                name: 'Type',
                value: channel.type
            }]
        });
    },

    channelDelete(bot, channel) {
        if (!channel.guild) // Ignore DM's
            return;

        const bguild = bot.guilds.get(channel.guild.id);

        bguild.log({
            title: '❌ Channel deleted',
            color: 0xFFFFFF,
            fields: [{
                name: 'Name',
                value: channel.name
            }, {
                name: 'Type',
                value: channel.type
            }]
        });
    },

    channelUpdate(bot, old_channel, new_channel) {
        if (!new_channel.guild) // Ignore DM's
            return;

        const bguild = bot.guilds.get(new_channel.guild.id);
        if (old_channel.name !== new_channel.name) {
            bguild.log({
                title: 'Channel updated',
                description: 'Name changed',
                color: 0xFFFFFF,
                fields: [{
                    name: 'Change',
                    value: `${old_channel.name} --> ${new_channel.name}`
                }, {
                    name: 'Type',
                    value: new_channel.type
                }]
            });
        }

        if (old_channel.position !== new_channel.position) {
            bguild.log({
                title: 'Channel updated',
                description: 'Position changed',
                color: 0xFFFFFF,
                fields: [{
                    name: 'Change',
                    value: `${old_channel.rawPosition} --> ${new_channel.rawPosition}`
                }, {
                    name: 'Type',
                    value: new_channel.type
                }]
            });
        }
    },

    roleCreate(bot, role) {
        const bguild = bot.guilds.get(role.guild.id);
        const extra_permissions = role.permissions.toArray().filter((permission) =>
            !role.guild.roles.everyone.permissions.has(permission)
        );

        bguild.log({
            title: '🎭✅ Role created',
            color: role.color,
            fields: [{
                name: 'Name',
                value: role.name
            }, {
                name: 'ID',
                value: role.id
            }, {
                name: 'Permissions above @everyone',
                value: extra_permissions.join(', ') || 'None'
            }]
        });
    },

    roleDelete(bot, role) {
        const bguild = bot.guilds.get(role.guild.id);
        const extra_permissions = role.permissions.toArray().filter((permission) =>
            !role.guild.roles.everyone.permissions.has(permission)
        );

        bguild.log({
            title: '🎭❌ Role deleted',
            color: role.color,
            fields: [{
                name: 'Name',
                value: role.name
            }, {
                name: 'ID',
                value: role.id
            }, {
                name: 'Permissions above @everyone',
                value: extra_permissions.join(', ') || 'None'
            }]
        });
    },

    roleUpdate(bot, old_role, new_role) {
        const old_permissions = old_role.permissions.toArray();
        const new_permissions = new_role.permissions.toArray();
        const fields = [];

        const permissions_removed = old_permissions.filter((permission) => !new_permissions.includes(permission));
        const permissions_granted = new_permissions.filter((permission) => !old_permissions.includes(permission));

        if (permissions_removed.length > 0 || permissions_granted.length > 0) {
            fields.push({
                name: 'Permissions removed',
                value: permissions_removed.join(', ') || 'None'
            }, {
                name: 'Permissions granted',
                value: permissions_granted.join(', ') || 'None'
            });
        }

        if (old_role.name !== new_role.name) {
            fields.push({
                name: 'Name',
                value: `${old_role.name} --> ${new_role.name}`
            });
        }

        if (old_role.hexColor !== new_role.hexColor) {
            fields.push({
                name: 'Colour',
                value: `#${old_role.hexColor} --> #${new_role.hexColor}`
            });
        }

        if (old_role.position !== new_role.position) {
            fields.push({
                name: 'Position',
                value: `#${old_role.rawPosition} --> #${new_role.rawPosition}`
            });
        }

        const bguild = bot.guilds.get(new_role.guild.id);

        if (fields.length > 0) {
            bguild.log({
                title: '🎭 Role updated',
                description: `${new_role.name} (${new_role.id})`,
                color: new_role.color,
                fields
            });
        }
    },

    // TODO: This event only fires when the message has been cached.
    //       We should hook into 'raw' and fire it anyway so we can
    //       give some kind of message.
    messageDelete(bot, msg) {
        const bguild = bot.guilds.get(msg.guild.id);

        bguild.log({
            title: '📜❌ Message deleted',
            description: `By: **${msg.author.tag}** (${msg.author.id}) in **#${msg.channel.name}**`,
            color: 0xFFFFFF,
            fields: [{
                name: 'Content',
                value: msg.content || '\\*\\*\\*Empty message***'
            }]
        });
    },

    // TODO: bulk delete logs
    // messageDeleteBulk(bot, msgs) {}

    async messageUpdate(bot, old_msg, new_msg) {
        const bguild = bot.guilds.get(new_msg.guild.id);

        // TODO: discord.js does not support forums yet
        // let parent_text = '';

        // if (new_msg.channel.parentId) {
        //     const parent_channel = await new_msg.guild.channels.fetch(new_msg.channel.parentId).catch(Logger.error);
        //     parent_text = ` (a thread from #${parent_channel.name})`;
        // }

        if (old_msg.content === new_msg.content)
            return;

        let content_diff = '';

        Diff.diffChars(old_msg.content, new_msg.content).forEach((chunk) => {
            let md = '';

            if (chunk.added)
                md = '**';
            else if (chunk.removed)
                md = '~~';

            content_diff += md + chunk.value + md;
        });

        bguild.log({
            title: '📜✏️ Message edited',
            description: `By: **${new_msg.author.tag}** (${new_msg.author.id}) in **#${new_msg.channel.name}**`,
            color: 0xFFFFFF,
            fields: [{
                name: 'Old content',
                value: old_msg.content || '\\*\\*\\*Empty message***'
            }, {
                name: 'New content',
                value: new_msg.content || '\\*\\*\\*Empty message***'
            }, {
                name: 'Diff',
                value: content_diff || '*No diff generated*'
            }]
        });

    }
};

module.exports = ActionLogger;
