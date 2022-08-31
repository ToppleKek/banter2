const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge } = require('../utils/utils');

module.exports.help = 'Toggle public roles';
module.exports.usage = '#PREFIXtpr <role>';
module.exports.required_permissions = ['MANAGE_ROLES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'role',
        type: 'role',
        description: 'Role to toggle the publicity of'
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
    const role = args.get('role');
    const [err, added] = await pledge(bguild.toggle_pub_role(role.id));

    if (err)
        throw new CommandError('SQLError', err.toString());

    msg.respond_info(`\`${role.name}\` is ${added ? 'now' : 'no longer'} a public role.`);
}
