const { Message } = require('discord.js');
const Bot = require('../bot');
const { pledge, command_error_if, generate_message_dump } = require('../utils/utils');
const CONFIG = require('../../config.json');

module.exports.help = 'Archive messages';
module.exports.usage = '#PREFIXarchive <n>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'n',
        type: 'number',
        description: 'Number of messages to archive'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    let err, msgs, file_path;
    [err, msgs] = await pledge(msg.channel.messages.fetch({ limit: args.get('n') }));
    command_error_if(err, 'APIError');
    [err, file_path] = await pledge(generate_message_dump(msgs, msg.channel));
    command_error_if(err, 'InternalError');

    msg.respond_info(`Archived ${msgs.size} messages. View the archive [here](${CONFIG.msg_log_base_url}/${file_path.replace('./', '')})`);
};
