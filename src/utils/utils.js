const { GuildMember } = require('discord.js');
const CONFIG = require('../../config.json');
const CommandError = require('../command_error');

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

    /**
     * Require a optional arg during command runtime
     * @param {String} key
     * @param {Map} args
     */
    require_optional(key, args) {
        if (!args.has(key))
            throw new CommandError('ArgumentError', `Optional argument \`${key}\` is required in this context.`);
    },

    /**
     * Get the guilds that the bot shares with the given user
     * @param {Bot} bot The bot
     * @param {import('discord.js').User} user The user
     * @return {Array<String>} An array of the names of the guilds shared with this user
     */
    guilds_shared_with(bot, user) {
        const shared_guilds = [];

        bot.client.guilds.cache.each((guild) => {
            if (guild.members.cache.get(user))
                shared_guilds.push(guild.name);
        });

        return shared_guilds;
    }
};
