const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');
const { Message, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { BUTTON_DANGER, BUTTON_PRIMARY } = require('../constants');

module.exports.help = 'Ban a member from the guild';
module.exports.usage = '#PREFIXnaenae <target> <?reason>';
module.exports.required_permissions = ['BAN_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'target',
        type: 'user',
        description: 'The user to ban'
    }],
    optional_args: [{
        name: 'reason',
        type: 'string',
        description: 'A reason for the ban'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    let err, member, author;
    [err, member] = await pledge(msg.guild.members.fetch(args.get('target')));
    [err, author] = await pledge(msg.guild.members.fetch(msg.author));

    const bguild = bot.guilds.get(msg.guild.id);

    const opts = {
        reason: `Ban issued by: ${msg.author.tag} - ${args.get('reason') ?? '(no reason provided)'}`
    };

    if (!member) {
        const target = args.get('target');
        const do_hacknaenae = (send_func) => {
            const ban_embed = {
                color: 1571692,
                title: `${target.displayName} JUST GOT HACKNAENAED`,
                description: 'GET FRICKED KIDDO',
                thumbnail: {
                    url: 'https://topplekek.xyz/lmao.gif',
                },
                timestamp: new Date().toISOString(),
            };

            msg.guild.bans.create(target, opts)
            .then(() => send_func({embeds:[ban_embed]}))
            .catch((err) => msg.respond_error(`API Error: \`\`\`${err}\`\`\``));

            bguild.mod_log('hacknaenae (ban)', msg.author, target, args.get('reason'));
        };
        const [err, existing_ban] = await pledge(msg.guild.bans.fetch(target));

        if (!err && existing_ban) {
            const yes_button = ButtonBuilder.from({label: 'Yes', style: BUTTON_DANGER, customId: 'yes_button'});
            const no_button = ButtonBuilder.from({label: 'No', style: BUTTON_PRIMARY, customId: 'no_button'});
            const action_row = ActionRowBuilder.from({components: [yes_button, no_button]});
            const opts = {
                embeds: [{
                    title: 'Confirmation',
                    description: `${target.toString()} is already banned. Do you want to update the ban reason/author?`,
                    color: 0xBA211C
                }],
                components: [action_row]
            };

            const interactable_message = await msg.respond(opts);
            const col = interactable_message.createMessageComponentCollector({time: 20000});

            col.on('collect', async (interaction) => {
                if (interaction.user.id !== msg.author.id)
                    return;

                if (interaction.customId === 'yes_button') {
                    col.stop('interact_yes');
                    const [err] = await pledge(msg.guild.bans.remove(target, 'Ban reason update'));
                    command_error_if(err);
                    do_hacknaenae(interaction.reply.bind(interaction));
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
            });
        } else
            do_hacknaenae(msg.respond.bind(msg));

        return;
    }

    msg.channel.sendTyping();

    if (!member.bannable)
        throw new CommandError('BotPermissionError', 'This user is not bannable by the bot');

    if (member.roles.highest.rawPosition >= author.roles.highest.rawPosition)
        throw new CommandError('PermissionError', `${member.user.displayName} has a higher or equal role`);

    const ban_embed = {
        color: 1571692,
        title: `${member.user.displayName} JUST GOT NAENAED`,
        description: 'GET FRICKED KIDDO',
        thumbnail: {
            url: 'https://topplekek.xyz/lmao.gif',
        },
        timestamp: new Date().toISOString(),
    };

    const dm_embed = {
        color: 1571692,
        title: `Get heckin naenaed from ${msg.guild.name}`,
        description: `They banned you for \`${args.get('reason') ?? 'No reason provided'}\``,
        timestamp: new Date().toISOString(),
    };

    await member.createDM().then((dm_channel) => dm_channel.send({embeds:[dm_embed]}))
        .catch((err) => msg.respond_error(`Warn: failed to DM user: ${err}`));

    member.ban(opts)
        .then(() => msg.respond({embeds: [ban_embed]}))
        .catch((err) => msg.respond_error(`API Error: \`\`\`${err}\`\`\``));

    bguild.mod_log('naenae (ban)', msg.author, member.user, args.get('reason'));
    bguild.add_naenae_stat(msg.author.id, 1);
};
