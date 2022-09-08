const { Message } = require('discord.js');
const Bot = require('../bot');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Toggle member roles';
module.exports.usage = '#PREFIXrole <target> <role>';
module.exports.required_permissions = ['MANAGE_MEMBERS'];
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
    let err, target;
    [err, target] = await pledge(
        msg.guild.members.fetch(args.get('target')),
    );
    command_error_if(err, 'APIError');

    if (target.roles.resolve(role.id) !== null) {
        [err] = await pledge(target.roles.remove(role));
        command_error_if(err, 'APIError');
        console.log('2');


        msg.respond_info(`Removed **${role.name}** from **${target.user.tag}**`);
    } else {
        [err] = await pledge(target.roles.add(role));
        command_error_if(err, 'APIError');
        console.log('3');


        msg.respond_info(`Added **${role.name}** to **${target.user.tag}**`);
    }
}
