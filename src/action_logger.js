const ActionLogger = {
    banter_guildMemberAdd(member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: 'Member joined',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
            fields: [{
                title: 'Invite Used',
                description: member.invite_code,
            }],
        });
    },

    guildMemberRemove(member) {
        const bguild = bot.guilds.get(member.guild.id);

        bguild.log({
            title: 'Member left',
            description: `${member.user.tag} (${member.user.id})`,
            color: 0xFFFFFF,
        });
    }
};

module.exports = ActionLogger;
