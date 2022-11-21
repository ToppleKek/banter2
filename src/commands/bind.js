const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Manage channel bindings';
module.exports.usage = '#PREFIXbind <?channel>';
module.exports.required_permissions = ['MANAGE_CHANNELS'];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'channel',
        type: 'channel',
        description: 'The channel to bind this channel to'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    const channel = args.get('channel');

    if (channel) {
        let err, removed, added, webhook;
        [err, removed] = await pledge(bguild.remove_channel_bind(msg.channelId));
        command_error_if(err, 'SQLError');

        [err, webhook] = await pledge(channel.createWebhook({ name: `Bind from ${msg.channel.name}` }));
        command_error_if(err, 'APIError');

        [err, added] = await pledge(bguild.add_channel_bind(msg.channelId, webhook.id));
        command_error_if(err, 'SQLError');

        msg.respond_info(`All messages from this channel will be sent in \`${channel.name}\`${removed ? ' (old bind for this channel removed)' : ''}`);
    } else {
        const [err, removed] = await pledge(bguild.remove_channel_bind(msg.channelId));
        command_error_if(err, 'SQLError');

        if (!removed)
            msg.respond_error('This channel is not bound anywhere. Bind it by executing this command with a channel argument.');
        else
            msg.respond_error('This channel is no longer bound anywhere.');
    }
}
