const { Message, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');
const { BUTTON_SECONDARY } = require('../constants');

module.exports.help = 'View this month\'s ban stats';
module.exports.usage = '#PREFIXbanstats';
module.exports.required_permissions = ['BAN_MEMBERS'];
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
    let [err, [ban_stats, naenae_stats]] = await pledge([bguild.get_ban_stats(), bguild.get_naenae_stats()]);
    command_error_if(err, 'SQLError');

    // Merge naenae and regular ban stats
    for (const id in naenae_stats) {
        if (!ban_stats[id])
            ban_stats[id] = naenae_stats[id];
        else
            ban_stats[id] += naenae_stats[id];
    }

    if (Object.keys(ban_stats).length === 0) {
        await msg.respond_info('There have been no bans recorded yet this month. (Stats do not update in real time, be patient.)');
        return;
    }

    const fields = [];
    for (const id in ban_stats) {
        let user;
        [err, user] = await pledge(bot.client.users.fetch(id));
        command_error_if(err, 'APIError');

        fields.push({
            name: `${user.displayName} (${user.tag})`,
            value: `${ban_stats[id]}`,
            inline: false
        });
    }

    fields.sort((a, b) => Number.parseInt(b.value) - Number.parseInt(a.value));

    const pages = [];
    let page = 0;

    while (fields.length)
        pages.push(fields.splice(0, 12));

    const next_button = ButtonBuilder.from({ label: '->' , style: BUTTON_SECONDARY, custom_id: 'next_button'});
    const prev_button = ButtonBuilder.from({ label: '<-' , style: BUTTON_SECONDARY, custom_id: 'prev_button'});
    const action_row = ActionRowBuilder.from({components: [prev_button, next_button]});

    const now = new Date();
    const opts = {
        embeds: [{
            title: `Ban stats on ${msg.guild.name} (${now.getMonth() + 1}/${now.getFullYear()})`,
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
}
