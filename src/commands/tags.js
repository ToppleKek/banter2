const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { require_optional, pledge, command_error_if, elide } = require('../utils/utils');

module.exports.help = 'Manage guild tags';
module.exports.usage = '#PREFIXtags <command> <?key> <?value>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'command',
        type: 'word',
        description: 'One of `add/remove/list`'
    }],
    optional_args: [{
        name: 'key',
        type: 'word',
        description: 'One word key'
    }, {
        name: 'value',
        type: 'string',
        description: 'The key value'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);

    if (args.get('command') === 'add') {
        require_optional('key', args);
        require_optional('value', args);

        const [err, added] = await pledge(bguild.add_tag(args.get('key'), args.get('value')));

        if (err)
            throw new CommandError('SQLError', err.toString());
        if (!added)
            throw new CommandError('ArgumentError', 'This key is already in use');

        msg.respond_info(`Added tag: ${args.get('key')}`);
    } else if (args.get('command') === 'remove') {
        require_optional('key', args);
        const [err, removed] = await pledge(bguild.remove_tag(args.get('key')));

        if (err)
            throw new CommandError('SQLError', err.toString());
        if (!removed)
            throw new CommandError('ArgumentError', 'This key does not exist');

        msg.respond_info(`Removed tag: ${args.get('key')}`);
    } else if (args.get('command') === 'list') {
        const [err, tags] = await pledge(bguild.get_tags());
        command_error_if(err, 'SQLError');
        const fields = tags.map((tag) => ({ name: tag.key, value: elide(tag.content, 75) }));

        msg.respond({embeds: [{
            title: `Tags on ${msg.guild.name}`,
            color: 0x259EF5,
            fields
        }]});
    } else {
        throw new CommandError('ArgumentError', 'Invalid command');
    }
}
