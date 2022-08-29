const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { require_optional, pledge } = require('../utils/utils');

module.exports.help = 'Get a tag';
module.exports.usage = '#PREFIXt <key>';
module.exports.required_permissions = [];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'key',
        type: 'word',
        description: 'One word key'
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
    const key = args.get('key');
    const [err, tags] = await pledge(bguild.get_tags());

    if (err)
        throw new CommandError('SQLError', err.toString()); // TODO: report these instead of this

    const tag = tags.find((t) => t.key === key);

    if (!tag)
        throw new CommandError('ArgumentError', 'Tag not found.');

    msg.respond_info(tag.content, tag.key);
}
