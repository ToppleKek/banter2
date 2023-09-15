const { Message } = require('discord.js');
const Bot = require('../bot');
const { pledge, command_error_if, elide } = require('../utils/utils');
const UUID = require('uuid');

module.exports.help = 'Add a note to a user ';
module.exports.usage = '#PREFIXaddnote <target> <content>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'User to add a note to'
    }, {
        name: 'content',
        type: 'string',
        description: 'The note content, if required'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const target = args.get('target');

    let err, notes;
    [err, notes] = await pledge(bot.db.allp('SELECT * FROM notes WHERE user_id = ?', target.id));
    command_error_if(err, 'SQLError');

    const content = args.get('content');
    [err] = await pledge(bot.db.runp(
        'INSERT INTO notes (user_id, author_id, guild_id, content, timestamp, id) VALUES (?, ?, ?, ?, ?, ?)',
        target.id,
        msg.author.id,
        msg.guild.id,
        content,
        Date.now().toString(),
        UUID.v4()
    ));

    command_error_if(err, 'SQLError');

    msg.respond_info(`Added note to user \`${target.toString()}\``);
    await bot.guilds.get(msg.guild.id).mod_log('add note', msg.author, target, elide(content, 30));
};
