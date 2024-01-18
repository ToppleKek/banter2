const { Message, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');
const { BUTTON_SECONDARY } = require('../constants');

module.exports.help = 'View ban stats from previous months';
module.exports.usage = '#PREFIXarchivedbanstats';
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
    let [err, archived_ban_stats] = await pledge(bguild.get_archived_ban_stats());
    command_error_if(err, 'SQLError');

    if (archived_ban_stats.length === 0) {
        await msg.respond_info('There is no historical data to show.');
        return;
    }

    const pages = [];
    let date_page = 0;
    let page = 0;

    for (const ban_stats of archived_ban_stats) {
        const fields = [];

        for (const id in ban_stats.stats) {
            let user;
            [err, user] = await pledge(bot.client.users.fetch(id));
            command_error_if(err, 'APIError');

            fields.push({
                name: `${user.displayName} (${user.tag})`,
                value: `${ban_stats.stats[id]}`,
                inline: false
            });
        }

        fields.sort((a, b) => Number.parseInt(b.value) - Number.parseInt(a.value));

        const sub_pages = [];
        while (fields.length)
            sub_pages.push(fields.splice(0, 12));

        pages.push({ month: ban_stats.month, year: ban_stats.year, pages: sub_pages });
    }

    const next_date_button = ButtonBuilder.from({ label: '-> (date)' , style: BUTTON_SECONDARY, custom_id: 'next_date_button'});
    const prev_date_button = ButtonBuilder.from({ label: '<- (date)' , style: BUTTON_SECONDARY, custom_id: 'prev_date_button'});
    const next_button = ButtonBuilder.from({ label: '-> (users)' , style: BUTTON_SECONDARY, custom_id: 'next_button'});
    const prev_button = ButtonBuilder.from({ label: '<- (users)' , style: BUTTON_SECONDARY, custom_id: 'prev_button'});
    const action_row = ActionRowBuilder.from({components: [prev_date_button, next_date_button, prev_button, next_button]});

    const now = new Date();
    const opts = {
        embeds: [{
            title: `Ban stats on ${msg.guild.name} (${pages[date_page].month}/${pages[date_page].year})`,
            fields: pages[date_page].pages[page],
            color: 0x9284FA,
            footer: {
                text: `(Date) Page ${date_page + 1}/${pages.length}, (User) Page ${page + 1}/${pages[date_page].pages.length}`
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

        if      (interaction.customId === 'next_date_button' && date_page < pages.length - 1)        ++date_page;
        else if (interaction.customId === 'prev_date_button' && date_page > 0)                       --date_page;
        else if (interaction.customId === 'prev_button' && page > 0)                                 --page;
        else if (interaction.customId === 'next_button' && page < pages[date_page].pages.length - 1) ++page;

        opts.embeds[0].fields = pages[date_page].pages[page];
        opts.embeds[0].title = `Ban stats on ${msg.guild.name} (${pages[date_page].month}/${pages[date_page].year})`;
        opts.embeds[0].footer.text = `(Date) Page ${date_page + 1}/${pages.length}, (User) Page ${page + 1}/${pages[date_page].pages.length}`;

        await interaction.update(opts);
    });

    col.on('end', async () => {
        opts.components = [];
        await interactable_message.edit(opts);
    });
}
