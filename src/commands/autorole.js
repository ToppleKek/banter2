const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Manage roles that are given to users when they join';
module.exports.usage = '#PREFIXautorole add member';
module.exports.required_permissions = ['MANAGE_ROLES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'command',
        type: 'string',
        description: 'One of `add/remove/list`'
    }],
    optional_args: [{
        name: 'target_role',
        type: 'role',
        description: 'The role you are operating on'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    msg.respond_info(`autorole command: got args: ${util.inspect(args)}`);
}
