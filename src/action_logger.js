const Logger = require('./logger');

const ActionLogger = {
    banter_guildMemberAdd(bot, member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: '✅ Member joined',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
            fields: [{
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
            }]
        });

    }
};

module.exports = ActionLogger;
