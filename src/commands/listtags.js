const { Message, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const { BUTTON_SECONDARY } = require('../constants');
const Bot = require('../bot');
const { pledge, command_error_if, elide } = require('../utils/utils');

module.exports.help = 'List guild tags';
module.exports.usage = '#PREFIXlisttags';
module.exports.required_permissions = [];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    const [err, tags] = await pledge(bguild.get_tags());
    command_error_if(err, 'SQLError');
    const fields = tags.map((tag) => ({ name: tag.key, value: elide(tag.content, 75) }));

    const pages = [];
    let page = 0;

    while (fields.length)
        pages.push(fields.splice(0, 10));

    const next_button = ButtonBuilder.from({ label: '->' , style: BUTTON_SECONDARY, custom_id: 'next_button'});
    const prev_button = ButtonBuilder.from({ label: '<-' , style: BUTTON_SECONDARY, custom_id: 'prev_button'});
    const action_row = ActionRowBuilder.from({components: [prev_button, next_button]});

    const opts = {
        embeds: [{
            title: `Tags on ${msg.guild.name}`,
            fields: pages[page],
            color: 0x259EF5,
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
}
