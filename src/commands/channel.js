const { Message } = require('discord.js');
const Bot = require('../bot');
const Utils = require('../utils/utils');
const CommandError = require('../command_error');
const Logger = require('../logger');
const util = require('util');
const { pledge } = require('../utils/utils');

module.exports.help = 'Manage channel settings';
module.exports.usage = '#PREFIXchannel <channel_type> <?command> <?target_channel>';
module.exports.required_permissions = ['MANAGE_CHANNELS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'channel_type',
        type: 'word',
        description: 'One of `log/modlog`'
    }],
    optional_args: [{
        name: 'command',
        type: 'word',
        description: 'One of set/disable'
    }, {
        name: 'target_channel',
        type: 'channel',
        description: 'The channel being set'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const b_guild = bot.guilds.get(msg.guild.id);
    const command = args.get('command');
    const channel_type = args.get('channel_type');

    if (!['log', 'modlog'].includes(channel_type))
        throw new CommandError('ArgumentError', 'channel_type must be one of `log/modlog`');

    if (!command) {
        const [err, channel_id] = await b_guild.db_get(channel_type);

        if (err)
            Logger.error(err);

        const channel = msg.guild.channels.cache.get(channel_id);

        if (!channel) {
            msg.respond_info(`No ${channel_type} is set for this server.`);
            return;
        }

        msg.respond_info(`${channel} is the current ${channel_type} channel.`);
        return;
    }

    switch (command) {
        case 'set': {
            Utils.require_optional('target_channel', args);
            const target_channel = args.get('target_channel');

            const [err] = await pledge(b_guild.db_set(channel_type, target_channel.id));

            if (err)
                throw new CommandError('SQLError', err);

            msg.respond_info(`This server's ${channel_type} channel is now ${target_channel}.`);
        } break;
        case 'disable': {
            const [err] = await pledge(b_guild.db_set(channel_type, null));

            if (err)
                throw new CommandError('SQLError', err);

            msg.respond_info(`The ${channel_type} channel has been disabled.`);
        } break;
        default:
            msg.respond_error('Invalid command');
    }
}
