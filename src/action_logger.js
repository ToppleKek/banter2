const Logger = require('./logger');

const ActionLogger = {
    banter_guildMemberAdd(bot, member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: 'Member joined',
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
            title: 'Member left',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
        });
    },

    // TODO: This event only fires when the message has been cached.
    //       We should hook into 'raw' and fire it anyway so we can
    //       give some kind of message.
    messageDelete(bot, msg) {
        const bguild = bot.guilds.get(msg.guild.id);

        bguild.log({
            title: '📜❌Message deleted',
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

        bguild.log({
            title: '📜✏️Message edited',
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
