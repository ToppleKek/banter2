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
     * @return {Array} An array of the guilds shared with the user
     */
    guilds_shared_with(bot, user) {
        return bot.client.guilds.cache.filter((guild) => !!!guild.members.resolve(user));
    },

    parse_time(str) {
        let times = {
            'd': 0,
            'h': 0,
            'm': 0,
            's': 0
        };
        let number_buf = '';

        for (let i = 0; i < str.length; ++i) {
            if (this._is_digit(str[i]))
                number_buf += str[i];
            else if (times.hasOwnProperty(str[i])) {
                times[str[i]] = Number.parseInt(number_buf);
                number_buf = '';
            } else
                return null;
        }

        if (number_buf !== '')
            return Number.parseInt(number_buf);

        return times.d * 86400 + times.h * 3600 + times.m * 60 + times.s;
    },

    _is_digit(c) {
        return c >= '0' && c <= '9';
    }

    // mute(bot, member, time, reason = 'No reason provided') {
    //     if (time <= 0)
    //         time = 9999999; // TODO: highest possible timeout?

    //     return member.timeout
    // }
};
