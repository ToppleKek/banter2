const { Message, PermissionsBitField } = require('discord.js');
const Bot = require('../bot');
const Utils = require('../utils/utils');
const CommandError = require('../command_error');
const Logger = require('../logger');
const util = require('util');
const { pledge } = require('../utils/utils');

module.exports.help = 'Toggle server statistics channels';
module.exports.usage = '#PREFIXstats <?show_unique_authors>';
module.exports.required_permissions = ['MANAGE_CHANNELS'];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'show_unique_authors',
        type: 'word',
        description: 'One of true/false yes/no (default=true)'
    }]
};

const GUILD_VOICE = 2;
const GUILD_CATEGORY = 4;

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    let show_unique_authors;

    if (['true', 'yes'].includes(args.get('show_unique_authors')))
        show_unique_authors = true;
    else if (['false', 'no'].includes(args.get('show_unique_authors')))
        show_unique_authors = false;
    else
        show_unique_authors = true;

    let [err, stat_channels] = await pledge(bguild.get_stat_channels());

    if (err)
        throw new CommandError('SQLError', err.toString());

    let parent_channel = null, total_users_channel = null, unique_author_channel = null;
    if (['parent_channel', 'total_users_channel', 'unique_author_channel'].every((c) => stat_channels[c] === null)) {
        const permissionOverwrites = [{
            id: msg.guild.roles.everyone.id,
            deny: PermissionsBitField.Flags.CONNECT
        }];

        [err, parent_channel] = await pledge(msg.guild.channels.create({name: 'Server Statistics', type: GUILD_CATEGORY}));

        if (err)
            throw new CommandError('APIError', err.toString());

        [err, total_users_channel] = await pledge(parent_channel.children.create({
            name: `Users: ${msg.guild.memberCount} (0)`,
            type: GUILD_VOICE,
            permissionOverwrites
        }));

        if (err)
            throw new CommandError('APIError', err.toString());

        if (show_unique_authors) {
            [err, unique_author_channel] = await pledge(parent_channel.children.create({
                name: `Active Today: 0 (0)`,
                type: GUILD_VOICE,
                permissionOverwrites
            }));

            if (err)
                throw new CommandError('APIError', err.toString());
        }

        [err] = await pledge(bguild.set_stat_channels({
            parent_channel: parent_channel.id,
            total_users_channel: total_users_channel.id,
            unique_author_channel: unique_author_channel.id
        }));

        if (err)
            throw new CommandError('SQLError', err.toString());

        const [errs] = await pledge([bguild.db_set('last_unique_author_count', 0), bguild.db_set('last_member_count', msg.guild.memberCount)]);

        if (errs.length > 0)
            throw new CommandError('SQLError', errs.map((e) => e.toString()).join('\n'));

        msg.respond_info('Enabled server statistics.');
    } else {
        // We need to ensure that stat channels can be disabled even if there is an error deleting the old channels.
        const errs = [];
        [err] = await pledge(msg.guild.channels.delete(stat_channels.unique_author_channel));

        if (err)
            errs.push(err.toString());

        [err] = await pledge(msg.guild.channels.delete(stat_channels.total_users_channel));

        if (err)
            errs.push(err.toString());

        [err] = await pledge(msg.guild.channels.delete(stat_channels.parent_channel));

        if (err)
            errs.push(err.toString());

        if (errs.length > 0)
            msg.respond_error(`Failed to delete some channels (errors listed):\n${errs.join('\n')}`);

        bguild.set_stat_channels({ parent_channel, total_users_channel, unique_author_channel });
        msg.respond_info('Disabled server statistics.');
    }
}
