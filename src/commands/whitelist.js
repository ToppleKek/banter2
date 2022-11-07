const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Manage whitelist settings';
module.exports.usage = '#PREFIXwhitelist <role> <?action> <?command>';
module.exports.required_permissions = ['ADMINISTRATOR'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'role',
        type: 'role',
        description: 'The role to manage whitelist rules for'
    }],
    optional_args: [{
        name: 'command',
        type: 'word',
        description: 'One of allow/deny'
    }, {
        name: 'action',
        type: 'word',
        description: 'One of logAntiDelete/antiPing/antiSpam'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    const target_role = args.get('role');

    const [err, whitelist_rules] = await pledge(bguild.get_whitelist_rules(target_role.id));
    command_error_if(err, 'SQLError');

    if (!args.get('action') || !args.get('command')) {
        const embed = {
            color: 0x9284FA,
            title: `Whitelist settings for role: ${target_role.name}`,
            fields: [{
                name: 'Log anti delete (\`logAntiDelete\`)', // TODO: Implement this
                value: whitelist_rules.logAntiDelete ? 'Allow' : 'Deny'
            }, {
                name: 'Anti ping spam (\`antiPing\`)',
                value: whitelist_rules.antiPing ? 'Allow' : 'Deny'
            }, {
                name: 'Anti spam (\`antiSpam\`)',
                value: whitelist_rules.antiSpam ? 'Allow' : 'Deny'
            }]
        };

        await msg.channel.send({embeds: [embed]});
        return;
    }

    if (!['logAntiDelete', 'antiPing', 'antiSpam'].includes(args.get('action')))
        throw new CommandError('ArgumentError', 'Invalid action (must be one of logAntiDelete/antiPing/antiSpam)');

    if (args.get('command').toLowerCase() === 'allow') {
        const [err, res] = await pledge(bguild.whitelist_add(target_role.id, args.get('action')));
        command_error_if(err, 'SQLError');

        if (!res)
            throw new CommandError('ArgumentError', 'This role is already allowed to bypass this action');

        msg.respond_info(`${target_role.name} is now allowed to bypass ${args.get('action')}`);
    } else if (args.get('command').toLowerCase() === 'deny') {
        const [err, res] = await pledge(bguild.whitelist_remove(target_role.id, args.get('action')));
        command_error_if(err, 'SQLError');

        if (!res)
            throw new CommandError('ArgumentError', 'This role is already unable to bypass this action');

        msg.respond_info(`The role \`${target_role.name}\` is now unable to bypass \`${args.get('action')}\``);
    } else
        throw new CommandError('ArgumentError', 'Invalid command (must be one of allow/deny)');
}
