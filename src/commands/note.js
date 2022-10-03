const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if, elide, require_optional } = require('../utils/utils');
const UUID = require('uuid');

module.exports.help = 'View and manage user notes';
module.exports.usage = '#PREFIXnote <target> <?command> <?content> <?n>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'User to manage notes of'
    }],
    optional_args: [{
        name: 'command',
        type: 'word',
        description: 'One of add/remove/remove_mine/view/page'
    }, {
        name: 'content',
        type: 'string',
        description: 'The note content, if required'
    }, {
        name: 'n',
        type: 'number',
        description: 'A note id or page number, if required'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const command = args.get('command');
    const target = args.get('target');

    let err, notes;
    [err, notes] = await pledge(bot.db.allp('SELECT * FROM notes WHERE user_id = ?', target.id));
    command_error_if(err, 'SQLError');

    switch (command) {
        case 'add': {
            require_optional('content', args);

            const content = args.get('content');
            const [err] = await pledge(bot.db.runp(
                'INSERT INTO notes (user_id, author_id, guild_id, content, timestamp, id) VALUES (?, ?, ?, ?, ?, ?)',
                target.id,
                msg.author.id,
                msg.guild.id,
                content,
                Date.now().toString(),
                UUID.v4()
            ));

            command_error_if(err, 'SQLError');

            msg.respond_info(`Added note to user \`${target.tag}\``);
        } break;
        case 'remove': {
            require_optional('n', args);
            const note_id = args.get('n');
            const to_remove = notes[note_id - 1];

            if (!to_remove)
                throw new CommandError('ArgumentError', 'Note not found.');

            const [err] = await pledge(bot.db.runp('DELETE FROM notes WHERE id = ?', to_remove.id));
            command_error_if(err, 'SQLError');

            msg.respond_info('Note removed.');
        } break;
        case 'remove_mine': {
            const [err] = await pledge(bot.db.runp(
                'DELETE FROM notes WHERE user_id = ? AND author_id = ? AND guild_id = ?',
                target.id,
                msg.author.id,
                msg.guild.id
            ));

            command_error_if(err, 'SQLError');

            msg.respond_info('Removed all notes created by you for this user.');
        } break;
        case 'view': {
            require_optional('n', args);

            const note_id = args.get('n');
            const note = notes[note_id - 1];

            if (!note)
                throw new CommandError('ArgumentError', 'Note not found');

            const [err, author] = await pledge(bot.client.users.fetch(note.author_id));
            command_error_if(err, 'APIError');

            const timestamp = Number.parseInt(note.timestamp);
            msg.channel.send({ embeds: [{
                title: `Note #${note_id} for \`${target.tag}\` at <t:${Math.floor(timestamp / 1000)}>`,
                author: {
                    name: author.tag,
                    iconURL: author.avatarURL({ size: 2048, dynamic: true, format: 'png' })
                },
                description: elide(note.content, 1000),
                timestamp: new Date(timestamp).toISOString()
            }]});
        } break;
        case undefined:
        case 'page': {
            if (command === 'page')
                require_optional('n', args);

            if (notes.length === 0) {
                msg.respond_info('This user has no notes.');
                return;
            }

            let i = 0;
            const fields = await Promise.all(notes.map(async (note) => {
                const [err, author] = await pledge(bot.client.users.fetch(note.author_id));
                command_error_if(err, 'APIError');

                return {
                    name: `${++i} - ${author.tag}`,
                    value: elide(note.content, 300)
                };
            }));

            const pages = [];

            while (fields.length)
                pages.push(fields.splice(0, 5));

            const page = args.get('n') ?? 1;

            if (page > pages.length)
                throw new CommandError('ArgumentError', 'Page not found');

            msg.channel.send({ embeds: [{
                title: `Notes for ${target.tag}`,
                fields: pages[page - 1],
                footer: {
                    text: `Page ${page}/${pages.length}`
                }
            }]});
        } break;
        default:
            throw new CommandError('ArgumentError', 'Invalid command');
    }
};
