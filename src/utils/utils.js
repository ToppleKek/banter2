const { GuildMember } = require('discord.js');
const CONFIG = require('../../config.json');
const CommandError = require('../command_error');
const Constants = require('../constants');
const UUID = require('uuid');
const fs = require('fs');

module.exports = {
    /**
     * Go style error handling
     * @param {Promise|Array<Promise>} p
     * @return {Promise} Error and result with no throws
     */
    pledge(p) {
        if (Array.isArray(p)) {
            return Promise.allSettled(p).then((results) => {
                const errs = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
                const values = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);

                return [errs, values];
            });
        }

        return p.then((r) => [null, r]).catch((e) => [e]);
    },

    command_error_if(err, type) {
        if (Array.isArray(err) && err.length > 0)
            throw new CommandError(type, err.map((e) => e.toString()).join('\n'));
        else if (!Array.isArray(err) && err)
            throw new CommandError(type, err.toString());
    },

    /**
     * Convert permission strings to a bitfield
     * Fix for discord.js v14 because these people keep
     * changing their fucking API and it pisses me off.
     * @param {Array<String>} permissions
     * @return {BigInt} Bitfield of permissions
     */
    permission_strings_to_bitfield(permissions) {
        return permissions.map((permission) => 1n << BigInt(Constants.permissions.indexOf(permission))).reduce((prev, current) => prev | current);
    },

    /**
     * Check if the given member has any of the given permissions
     * @param {GuildMember} member
     * @param {Array<String>} permissions
     * @return {boolean} True if the member has permission
     */
    check_permissions(member, permissions) {
        if (permissions.length <= 0)
            return true;
        else if (permissions[0] === 'BOT_OWNER')
            return member.user.id === CONFIG.owner_id;

        const bitfield = module.exports.permission_strings_to_bitfield(permissions);
        return member.permissions.any(bitfield, true);
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
        return bot.client.guilds.cache.filter((guild) => !!guild.members.resolve(user));
    },

    generate_message_dump(msgs, channel) {
        const log_content = msgs.map((msg) => {
            const embed_desc = msg?.embeds.map((embed) => JSON.stringify(embed));
            return `[${msg.createdAt.toUTCString()}] ${msg.author.tag} - ${msg.content}${embed_desc?.length ? `<br>EMBEDS:<br>${embed_desc}` : ''}`;
        });

        log_content.push(`***Message log generated at ${new Date().toUTCString()} on guild ${channel.guild.name} in channel #${channel.name}.***`);
        log_content.reverse();

        const file_content = `<html><head><meta name="robots" content="noindex"></head><body style="font-family:monospace;font-size:14px;">${log_content.join('<br>')}</body></html>`;
        const file_name = UUID.v4() + '.html';
        const file_path = `${CONFIG.msg_log_dir}/${channel.guild.id}/${file_name}`;

        return new Promise((resolve, reject) => {
            fs.mkdir(`${CONFIG.msg_log_dir}/${channel.guild.id}`, { recursive: true }, (mkdir_err) => {
                if (mkdir_err)
                    reject(mkdir_err);

                fs.writeFile(file_path, file_content, (write_err) => {
                    if (write_err)
                        reject(write_err);

                    resolve(file_path);
                });
            })
        });
    },

    parse_time(timestr) {
        const is_digit = (c) => {
            return c >= '0' && c <= '9';
        };

        let times = {
            'd': 0,
            'h': 0,
            'm': 0,
            's': 0
        };

        let number_buf = '';
        const str = timestr.replace(/\s/g, '');

        for (let i = 0; i < str.length; ++i) {
            if (is_digit(str[i]))
                number_buf += str[i];
            else if (times.hasOwnProperty(str[i])) {
                const num = Number.parseInt(number_buf);

                if (Number.isNaN(num))
                    return null;

                times[str[i]] = num;
                number_buf = '';
            } else
                return null;
        }

        if (number_buf !== '')
            return Number.parseInt(number_buf);

        return times.d * 86400 + times.h * 3600 + times.m * 60 + times.s;
    },

    escape_markdown(str) {
        return str.replace(/\*|\~|_|\||\`/g, (match) => '\\' + match);
    },

    match_array_length(arr1, arr2, pad) {
        if (arr1.length > arr2.length) {
            const n = arr1.length - arr2.length;
            for (let i = 0; i < n; ++i)
                arr2.push(pad);
        } else if (arr1.length < arr2.length) {
            const n = arr2.length - arr1.length;
            for (let i = 0; i < n; ++i)
                arr1.push(pad);
        }
    },

    // mute(bot, member, time, reason = 'No reason provided') {
    //     if (time <= 0)
    //         time = 9999999; // TODO: highest possible timeout?

    //     return member.timeout
    // }
};
