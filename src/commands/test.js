const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Test args';
module.exports.usage = '#PREFIXtest';
module.exports.required_permissions = ['BOT_OWNER'];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'arg2',
        type: 'user',
        description: 'Arg1 test is a user mention (user for slash commands)'
    }],
    optional_args: [{
        name: 'arg1',
        type: 'string',
        description: 'Arg1 test is a string'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    msg.respond_info(`hello ${args.get("arg2").username} you said ${args.get("arg1")}`);
}
