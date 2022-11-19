const Logger = require('./logger');
const CONFIG = require('../config.json');
const Util = require('./utils/utils');
const Diff = require('diff');
const { pledge, generate_message_dump, guilds_shared_with, elide } = require('./utils/utils');
const { CHANNEL_STRINGS } = require('./constants');

const ActionLogger = {
    async userUpdate(bot, old_user, new_user) {
        (await guilds_shared_with(bot, new_user)).forEach((guild) => {
            const bguild = bot.guilds.get(guild.id);
            if (old_user.tag !== new_user.tag) {
                bguild.log({
                    title: '👤 User tag updated',
                    description: `${old_user.tag} --> ${new_user.tag}`,
                    color: 0xFFFFFF,
                    thumbnail: {
                        url: new_user.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' })
                    }
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
                value: member.invite_code ?? 'Unknown',
            }, {
                name: 'Inviter',
                value: member?.inviter?.tag ?? '(Server discovery?)'
            }],
            thumbnail: {
                url: member.user.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' })
            }
        });
    },

    guildMemberRemove(bot, member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: '👤❌ Member left',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
            thumbnail: {
                url: member.user.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' })
            }
        });
    },

    async guildBanAdd(bot, ban) {
        const bguild = bot.guilds.get(ban.guild.id);
        ban = await ban.fetch();

        bguild.log({
            title: '👤⛔ Member banned',
            description: `${ban.user.tag} (${ban.user.id})`,
            fields: [{
                name: 'Reason',
                value: ban.reason || 'No reason provided'
            }],
            thumbnail: {
                url: ban.user.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' })
            },
            color: 0xBA211C
        });
    },

    async guildBanRemove(bot, ban) {
        const bguild = bot.guilds.get(ban.guild.id);

        bguild.log({
            title: '👤☑️ Member unbanned',
            description: `${ban.user.tag} (${ban.user.id})`,
            fields: [{
                name: 'Original Ban Reason',
                value: ban.reason || 'No reason provided'
            }],
            thumbnail: {
                url: ban.user.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' })
            },
            color: 0xFFFFFF
        });
    },

    guildMemberUpdate(bot, old_member, new_member) {
        const bguild = bot.guilds.get(new_member.guild.id);

        if (old_member.nickname !== new_member.nickname) {
            bguild.log({
                title: '👤 Member nickname changed',
                description: `${new_member.user.tag} (${new_member.id})\n\n${old_member.nickname} --> ${new_member.nickname}`,
                color: 0xFFFFFF,
            });
        }

        const role_diff = old_member.roles.cache.difference(new_member.roles.cache);
        const old_roles = old_member.roles.cache.map((role) => role.name).join(', ');
        const new_roles = new_member.roles.cache.map((role) => role.name).join(', ');

        if (role_diff.size > 0) {
            bguild.log({
                title: '👤🎭 Member roles changed',
                description: `${new_member.user.tag} (${new_member.id})\n\nOld: ${old_roles}\nNew:${new_roles}`,
                color: 0xFFFFFF
            });
        }
    },

    channelCreate(bot, channel) {
        if (!channel.guild) // Ignore DM's
            return;

        const bguild = bot.guilds.get(channel.guild.id);

        bguild.log({
            title: '✅📔 Channel created',
            color: 0xFFFFFF,
            fields: [{
                name: 'Name',
                value: channel.name
            }, {
                name: 'Type',
                value: CHANNEL_STRINGS[channel.type]
            }]
        });
    },

    channelDelete(bot, channel) {
        if (!channel.guild) // Ignore DM's
            return;

        const bguild = bot.guilds.get(channel.guild.id);

        bguild.log({
            title: '❌📔 Channel deleted',
            color: 0xFFFFFF,
            fields: [{
                name: 'Name',
                value: channel.name
            }, {
                name: 'Type',
                value: CHANNEL_STRINGS[channel.type]
            }]
        });
    },

    async channelUpdate(bot, old_channel, new_channel) {
        if (!new_channel.guild) // Ignore DM's
            return;

        const bguild = bot.guilds.get(new_channel.guild.id);
        const [err, stat_channels_obj] = await pledge(bguild.get_stat_channels());

        if (!err) {
            const stat_channels = [
                stat_channels_obj.parent_channel,
                stat_channels_obj.total_users_channel,
                stat_channels_obj.unique_author_channel
            ];

            // Ignore the stat channel updates as it spams the log
            if (stat_channels.includes(new_channel.id))
                return;
        }


        if (old_channel.name !== new_channel.name) {
            bguild.log({
                title: '📔 Channel updated',
                description: `${new_channel.name} (${new_channel.id})`,
                color: 0xFFFFFF,
                fields: [{
                    name: 'Type',
                    value: CHANNEL_STRINGS[new_channel.type]
                }, {
                    name: 'Name',
                    value: `${old_channel.name} --> ${new_channel.name}`
                }]
            });
        }

        if (old_channel.rawPosition !== new_channel.rawPosition) {
            bguild.log({
                title: '📔 Channel updated',
                description: `${new_channel.name} (${new_channel.id})`,
                color: 0xFFFFFF,
                fields: [{
                    name: 'Type',
                    value: CHANNEL_STRINGS[new_channel.type]
                }, {
                    name: 'Position',
                    value: `${old_channel.rawPosition} --> ${new_channel.rawPosition}`
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
                value: elide(msg.content, 1024) || '\\*\\*\\*Empty message***'
            }]
        });
    },

    async messageDeleteBulk(bot, msgs, channel) {
        const bguild = bot.guilds.get(channel.guild.id);

        const [err, file_path] = await pledge(generate_message_dump(msgs, channel));

        if (err) {
            Logger.error(err);
            return;
        }

        let file_name = file_path.split('/');
        file_name = file_name[file_name.length - 1];

        bguild.log({
            title: '📜❌ Messages deleted',
            description: `In **#${channel.name}**\n\nView the log [here](${CONFIG.msg_log_base_url}/${channel.guild.id}/${file_name})`,
            color: 0xFFFFFF
        });
    },

    async messageUpdate(bot, old_msg, new_msg) {
        const bguild = bot.guilds.get(new_msg.guild.id);

        if (old_msg.content === new_msg.content)
            return;

        const is_code_block = (s) => s.startsWith('```') && s.endsWith('```');
        const splitter = /(`{3}.*?`{3})/gs;
        const old_content_chunks = old_msg.content.split(splitter);
        const new_content_chunks = new_msg.content.split(splitter);
        const diff_chunks = [];

        Util.match_array_length(old_content_chunks, new_content_chunks, '');

        for (let i = 0; i < old_content_chunks.length; ++i) {
            if (is_code_block(old_content_chunks[i].trim()) && is_code_block(new_content_chunks[i].trim())) {
                let old_code = old_content_chunks[i].trim().slice(3, old_content_chunks[i].length);
                let new_code = new_content_chunks[i].trim().slice(3, new_content_chunks[i].length);
                old_code = old_code.slice(0, old_code.length - 3).trim();
                new_code = new_code.slice(0, new_code.length - 3).trim();

                let diff = '```diff\n';

                Diff.diffLines(old_code, new_code).forEach((chunk) => {
                    if (!chunk.value.endsWith('\n'))
                        chunk.value += '\n';

                    if (chunk.added)
                        diff += chunk.value.split('\n').map((c) => `+${c}`).join('\n').slice(0, -1);
                    else if (chunk.removed)
                        diff += chunk.value.split('\n').map((c) => `-${c}`).join('\n').slice(0, -1);
                    else
                        diff += chunk.value.split('\n').map((c) => ` ${c}`).join('\n').slice(0, -1);
                });

                diff_chunks.push(diff + '```');
            } else {
                let diff = '';

                Diff.diffWords(Util.escape_markdown(old_content_chunks[i]), Util.escape_markdown(new_content_chunks[i])).forEach((chunk) => {
                    let md = '';

                    if (chunk.added)
                        md = '**';
                    else if (chunk.removed)
                        md = '~~';

                    diff += md + chunk.value + md;
                });

                diff_chunks.push(diff);
            }
        }

        const context_link = `https://discord.com/channels/${new_msg.guild.id}/${new_msg.channel.id}/${new_msg.id}`;

        bguild.log({
            title: '📜✏️ Message edited',
            description: `By: **${new_msg.author.tag}** (${new_msg.author.id}) in **#${new_msg.channel.name}**\n[Jump to Context](${context_link})`,
            color: 0xFFFFFF,
            fields: [{
                name: 'Old content',
                value: elide(old_msg.content, 1024) || '\\*\\*\\*Empty message***',
                inline: true
            }, {
                name: 'New content',
                value: elide(new_msg.content, 1024) || '\\*\\*\\*Empty message***',
                inline: true
            }, {
                name: 'Diff',
                value: elide(diff_chunks.filter((chunk) => chunk !== '').join(''), 1024) || '*No diff generated*',
            }]
        });

    }
};

module.exports = ActionLogger;
