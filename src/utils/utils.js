const { GuildMember } = require('discord.js');
const CONFIG = require('../../config.json');

module.exports = {
    /**
     * Check if the given member has the given permissions
     * @param {GuildMember} member 
     * @param {Array<import('discord.js').PermissionResolvable>} permissions 
     * @return bool True if the member has permission
     */
    check_permissions(member, permissions) {
        if (permissions.length <= 0)
            return true;
        else if (permissions[0] === 'BOT_OWNER')
            return member.user.id === CONFIG.owner_id;

        return member.permissions.any(permissions, true);
    },

    /**
     * Get a user object from an ID or the author's user object if one is not found
     * @param {Bot} bot
     * @param {String} id
     * @param {import('discord.js').Message} msg
     * @return {Promise<import('discord.js').User>} The user object from the ID or the message author's if not found
     */
    user_or_author(bot, id, msg) {
        return new Promise(async (resolve, reject) => {
            const user = await bot.client.users.fetch(id)
                .catch((err) => resolve(msg.author));

            if (user)
                resolve(user);
            else
                resolve(msg.author);
        });
    },
};