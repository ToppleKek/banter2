const { Message } = require('discord.js');
const Bot = require('../bot');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Toggle member roles';
module.exports.usage = '#PREFIXrole <target> <role>';
module.exports.required_permissions = ['MANAGE_ROLES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The member to manage'
    }, {
        name: 'role',
        type: 'role',
        description: 'The role to toggle'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const role = args.get('role');
    let errs, target, author;
    [errs, [target, author]] = await pledge([
        msg.guild.members.fetch(args.get('target')),
        msg.guild.members.fetch(msg.author)
    ]);
    command_error_if(errs, 'APIError');

    if (role.comparePositionTo(author.roles.highest) > 0) {
        msg.respond_error(`You cannot manage the role **${role.name}** because it has a higher position than your highest role.`);
        return;
    }

    if (target.roles.resolve(role.id) !== null) {
        [err] = await pledge(target.roles.remove(role));
        command_error_if(err, 'APIError');

        msg.respond_info(`Removed **${role.name}** from **${target.user.tag}**`);
        bot.guilds.get(msg.guild.id).mod_log(`remove role ${role.name}`, msg.author, target.user);
    } else {
        [err] = await pledge(target.roles.add(role));
        command_error_if(err, 'APIError');

        msg.respond_info(`Added **${role.name}** to **${target.user.tag}**`);
        bot.guilds.get(msg.guild.id).mod_log(`add role ${role.name}`, msg.author, target.user);
    }
}
