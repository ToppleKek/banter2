const { Message } = require('discord.js');
const Bot = require('../bot');
const Utils = require('../utils/utils');
const CommandError = require('../command_error');
const Logger = require('../logger');
const util = require('util');

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

// TODO: In this case, you cannot type the arguments 'channel_type' and 'command' without quotes.
//       We need to introduce a 'word' type for arguments that only takes single words.

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
        const channel = msg.guild.channels.cache.get(await b_guild.db_get(channel_type));

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

            const added = await b_guild.db_set(channel_type, target_channel.id).catch((err) => {
                throw new CommandError('SQLError', err);
            });

            if ((typeof added) === 'boolean') // TODO: stupid. changing db_set and db_get responses soon
                msg.respond_info(`This server's ${channel_type} channel is now ${target_channel}.`);
        } break;
        case 'disable': {
            const removed = await b_guild.db_set(channel_type, null).catch((err) => {
                throw new CommandError('SQLError', err);
            });

            if ((typeof removed) === 'boolean') // TODO: stupid. changing db_set and db_get responses soon
                msg.respond_info(`The ${channel_type} channel has been disabled.`);
        } break;
        default:
            msg.respond_error('Invalid command');
    }
}
