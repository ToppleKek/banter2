const { Message, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { BUTTON_DANGER, BUTTON_PRIMARY } = require('../constants');
const Logger = require('../logger');
const { pledge } = require('../utils/utils');

module.exports.help = 'Unban all users from the guild';
module.exports.usage = '#PREFIXwhipall <?reason>';
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

    if (bguild.temp_storage().get('whipall_lock')) {
        msg.respond_error('There is another whipall command still running.');
        return;
    }

    const [err, bans] = await pledge(msg.guild.bans.fetch());

    if (err)
        throw new CommandError('APIError', err.toString());

    if (bans.size === 0) {
        msg.respond_info('There are no banned users in this guild.');
        return;
    }

    const yes_button = ButtonBuilder.from({label: 'Yes', style: BUTTON_DANGER, customId: 'yes_button'});
    const no_button = ButtonBuilder.from({label: 'No', style: BUTTON_PRIMARY, customId: 'no_button'});
    const action_row = ActionRowBuilder.from({components: [yes_button, no_button]});

    const opts = {
        embeds: [{
            title: 'Warning',
            description: `This will unban **${bans.size}** users from **${msg.guild.name}**. Are you sure you want to continue?`,
            color: 0xBA211C
        }],
        components: [action_row]
    };

    const interactable_message = await msg.respond(opts);
    const col = interactable_message.createMessageComponentCollector({time: 20000});

    const do_unban_all = async (progress_message) => {
        bguild.temp_storage().set('whipall_lock', true);

        bot.guilds.get(msg.guild.id).mod_log('whipall (unban)', msg.author, `${bans.size} users`);

        let i = 0;
        await Promise.all(bans.map(async (ban) => { // It is critical that this never throws, otherwise the lock will never be unlocked
            const [err] = await pledge(msg.guild.bans.remove(ban.user));

            if (err)
                Logger.error(err);

            if (++i % 5 === 0) {
                progress_message.edit({embeds: [{
                    description: `Unbanning all users... (${i}/${bans.size})`,
                    color: 0x259EF5
                }]}).catch(Logger.error);
            }
        }));

        bguild.temp_storage().set('whipall_lock', false);
        msg.respond_info('Finished unbanning all users.');
    };

    col.on('collect', async (interaction) => {
        if (interaction.user.id !== msg.author.id)
            return;

        if (interaction.customId === 'yes_button') {
            col.stop('interact_yes');
            do_unban_all(await interaction.reply({fetchReply: true, embeds: [{
                description: `Unbanning all users... (0/${bans.size})`,
                color: 0x259EF5
            }]}));
        } else if (interaction.customId === 'no_button') {
            col.stop('interact_no');
            interaction.reply({embeds: [{
                description: 'Aborted.'
            }]});
        }
    });

    col.on('end', async (collected, reason) => {
        opts.components = [];
        interactable_message.edit(opts);

        if (!reason.startsWith('interact'))
            msg.respond_info(`Whipall prompt executed by ${msg.author.tag} timed out.`);
    });
};
