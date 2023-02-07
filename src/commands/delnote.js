const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Remove a note from a user';
module.exports.usage = '#PREFIXdelnote <target> <n>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'User to remove a note from'
    }, {
        name: 'n',
        type: 'number',
        description: 'A note id',
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

    const note_id = args.get('n');
    const to_remove = notes[note_id - 1];

    if (!to_remove)
        throw new CommandError('ArgumentError', 'Note not found.');

    [err] = await pledge(bot.db.runp('DELETE FROM notes WHERE id = ?', to_remove.id));
    command_error_if(err, 'SQLError');

    msg.respond_info('Note removed.');
    await bot.guilds.get(msg.guild.id).mod_log('remove note', msg.author, target);
};
