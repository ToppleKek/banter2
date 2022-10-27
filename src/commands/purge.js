const { Message } = require('discord.js');
const Bot = require('../bot');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Purge messages (that are less than 2 weeks old)';
module.exports.usage = '#PREFIXpurge <n>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'n',
        type: 'number',
        description: 'Number of messages to delete'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    let err, log_id;
    [err, log_id] = await pledge(bguild.db_get('log'));

    if (bguild.config_get('logNoP') && !err && log_id === msg.channel.id) {
        msg.respond_error('This command is disabled in this channel.');
        return;
    }

    [err] = await pledge(msg.channel.bulkDelete(args.get('n') + 1));
    command_error_if(err, 'APIError');

    msg.respond_info(`Purged ${args.get('n')} messages.`);
    bguild.mod_log(`purge ${args.get('n')} msgs`, msg.author, msg.channel.name);
};
