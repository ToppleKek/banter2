const { Message, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');
const { BUTTON_SECONDARY } = require('../constants');

module.exports.help = 'Role yourself';
module.exports.usage = '#PREFIXpubrole <pubrole>';
module.exports.required_permissions = [];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'pubrole',
        type: 'role',
        description: 'Public role to get'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    const pubrole = args.get('pubrole');
    const [err, pubroles] = await pledge(bguild.get_pub_roles());

    if (err)
        throw new CommandError('UnknownError', err.toString());

    if (!pubrole) {
        const [err, fetched_pubroles] = await pledge(Promise.all(pubroles.map(async (p) => ({role: await msg.guild.roles.fetch(p), id: p}))));
        command_error_if(err, 'APIError');

        const human_roles = fetched_pubroles.map((p) => {
            if (!p.role) {
                bguild.toggle_pub_role(p.id);
                return null;
            }

            return p.role.name;
        }).filter((p) => p !== null);

        const pages = [];
        let page = 0;

        while (human_roles.length)
            pages.push(human_roles.splice(0, 12));

        const next_button = ButtonBuilder.from({ label: '->' , style: BUTTON_SECONDARY, custom_id: 'next_button'});
        const prev_button = ButtonBuilder.from({ label: '<-' , style: BUTTON_SECONDARY, custom_id: 'prev_button'});
        const action_row = ActionRowBuilder.from({components: [prev_button, next_button]});

        const opts = {
            embeds: [{
                title: `Public roles on ${msg.guild.name}`,
                description: pages[page].join('\n'),
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
                opts.embeds[0].description = pages[++page].join('\n'),
                opts.embeds[0].footer.text = `Page ${page + 1}/${pages.length}`;
            } else if (interaction.customId === 'prev_button' && page > 0) {
                opts.embeds[0].description = pages[--page].join('\n'),
                opts.embeds[0].footer.text = `Page ${page + 1}/${pages.length}`;
            }

            await interaction.update(opts);
        });

        col.on('end', async () => {
            opts.components = [];
            await interactable_message.edit(opts);
        });

        return;
    }

    if (!pubroles.includes(pubrole.id)) {
        msg.respond_error('That role is not public.');
        return;
    }

    const member = msg.guild.members.resolve(msg.author);
    const add = !member.roles.cache.has(pubrole.id);

    if (add) {
        const [err] = await pledge(member.roles.add(pubrole));
        command_error_if(err, 'APIError');
    } else {
        const [err] = await pledge(member.roles.remove(pubrole));
        command_error_if(err, 'APIError');
    }

    msg.respond_info(`You ${add ? 'now' : 'no longer'} have the \`${pubrole.name}\` role.`);
}
