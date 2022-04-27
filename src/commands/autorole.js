const { Message } = require("discord.js");
const Bot = require("../bot");
const Utils = require("../utils/utils");
const CommandError = require("../command_error");

module.exports.help = 'Manage roles that are given to users when they join';
module.exports.usage = '#PREFIXautorole <command> <?target_role>';
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
    switch (args.get('command')) {
        case 'add': {
            Utils.require_optional('target_role', args);
            const target_role = args.get('target_role');
            const b_guild = bot.guilds.get(msg.guild.id);

            const added = await b_guild.add_auto_role(target_role.id).catch((err) => {
                throw new CommandError('SQLError', err);
            });

            if (added)
                msg.respond_info(`Added auto role: \`${target_role.name}\``);
            else
                throw new CommandError('ArgumentError', `The role \`${target_role.name}\` is already an auto role.`);
        } break;
        case 'remove': {
            Utils.require_optional('target_role', args);
            const target_role = args.get('target_role');
            const b_guild = bot.guilds.get(msg.guild.id);

            const removed = await b_guild.remove_auto_role(target_role.id).catch((err) => {
                throw new CommandError('SQLError', err);
            });

            if (removed)
                msg.respond_info(`Removed auto role: \`${target_role.name}\``);
            else
                throw new CommandError('ArgumentError', `The role \`${target_role.name}\` is not already an auto role.`);
        } break;
        case 'list': {
            const b_guild = bot.guilds.get(msg.guild.id);
            const auto_roles = await b_guild.get_auto_roles();
            let message = '';

            for (const role of auto_roles)
                message += `${(await msg.guild.roles.cache.get(role)).name} - \`${role}\`\n`;


            msg.respond_info(message || 'None.', 'This server\'s auto roles');
        } break;
        default:
            msg.respond_error('Invalid command');
    }
}
