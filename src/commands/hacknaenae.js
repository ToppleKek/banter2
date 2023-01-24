const { Message } = require('discord.js');
const Bot = require('../bot');

module.exports.help = 'Alias of naenae';
module.exports.usage = '#PREFIXhacknaenae <target> <?reason>';
module.exports.required_permissions = ['BAN_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to ban'
    }],
    optional_args: [{
        name: 'reason',
        type: 'string',
        description: 'A reason for the ban'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    return await require('./naenae').main(bot, args, msg);
};
