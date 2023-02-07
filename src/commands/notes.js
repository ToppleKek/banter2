const { Message, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if, elide, require_optional } = require('../utils/utils');
const UUID = require('uuid');
const { BUTTON_SECONDARY } = require('../constants');

module.exports.help = 'View user notes';
module.exports.usage = '#PREFIXnote <target> <?n>';
module.exports.required_permissions = ['MANAGE_MESSAGES'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'User to view notes of'
    }],
    optional_args: [{
        name: 'n',
        type: 'number',
        description: 'A note id number to view',
        suppress_warnings: true
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

    if (notes.length === 0) {
        msg.respond_info('This user has no notes.');
        return;
    }

    if (args.get('n')) {
        const note_id = args.get('n');
        const note = notes[note_id - 1];

        if (!note)
            throw new CommandError('ArgumentError', 'Note not found');

        const [err, author] = await pledge(bot.client.users.fetch(note.author_id));
        command_error_if(err, 'APIError');

        const timestamp = Number.parseInt(note.timestamp);
        msg.respond({ embeds: [{
            title: `Note #${note_id} for \`${target.tag}\` at <t:${Math.floor(timestamp / 1000)}>`,
            author: {
                name: author.tag,
                iconURL: author.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' })
            },
            description: elide(note.content, 1000),
            timestamp: new Date(timestamp).toISOString()
        }]});

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
    let page = 0;

    while (fields.length)
        pages.push(fields.splice(0, 5));

    const next_button = ButtonBuilder.from({ label: '->' , style: BUTTON_SECONDARY, custom_id: 'next_button'});
    const prev_button = ButtonBuilder.from({ label: '<-' , style: BUTTON_SECONDARY, custom_id: 'prev_button'});
    const action_row = ActionRowBuilder.from({components: [prev_button, next_button]});

    const opts = {
        embeds: [{
            title: `Notes for ${target.tag}`,
            fields: pages[page],
            color: 0x9284FA,
            footer: {
                text: `Page ${page + 1}/${pages.length}`
            },
        }],
        components: [action_row]
    };

    const interactable_message = await msg.respond(opts);
    const col = interactable_message.createMessageComponentCollector({ time: 60000 });

    col.on('collect', async (interaction) => {
        if (interaction.user.id !== msg.author.id) {
            await interaction.reply({embeds: [{
                description: `These buttons are only valid for ${msg.author.tag}`,
                color: 0xFF6640
            }], flags: 1 << 6});

            return;
        }

        if (interaction.customId === 'next_button' && page < pages.length - 1) {
            opts.embeds[0].fields = pages[++page];
            opts.embeds[0].footer.text = `Page ${page + 1}/${pages.length}`;
        } else if (interaction.customId === 'prev_button' && page > 0) {
            opts.embeds[0].fields = pages[--page];
            opts.embeds[0].footer.text = `Page ${page + 1}/${pages.length}`;
        }

        await interaction.update(opts);
    });

    col.on('end', async () => {
        opts.components = [];
        await interactable_message.edit(opts);
    });
};
