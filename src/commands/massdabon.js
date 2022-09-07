const { Message, MessageActionRow, MessageButton } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const Logger = require('../logger');
const { pledge, parse_time } = require('../utils/utils');

module.exports.help = 'Mass kick members that joined in the specified time period';
module.exports.usage = '#PREFIXmassdabon <timestr> <?reason>';
module.exports.required_permissions = ['KICK_MEMBERS'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'timestr',
        type: 'string',
        description: 'How far back in time to flag users for removal'
    }],
    optional_args: [{
        name: 'reason',
        type: 'string',
        description: 'Reason for this action'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    const reason = `Massdabon executed by ${msg.author.tag} - ${args.get('reason') ?? 'No reason provided'}`;

    if (bguild.temp_storage().get('massdabon_lock')) {
        msg.respond_error('There is another massdabon command still running.');
        return;
    }

    const timestr = args.get('timestr').replace(/\s/g, '');
    let time = parse_time(timestr);

    if (time === null)
        throw new CommandError('ArgumentError', 'Invalid time string format (Valid example: "2h 42m 16s")');

    time *= 1000;

    if (time > 86400000)
        throw new CommandError('ArgumentError', 'Time cannot be greater than 1 day');

    const now = Date.now();
    let [err, members] = await pledge(msg.guild.members.fetch());

    if (err)
        throw new CommandError('APIError', err.toString());

    members = members.filter((member) => member.joinedTimestamp > (now - time));

    if (members.size === 0) {
        msg.respond_info(`There are no members who have joined in this time range (\`${time}ms\`)`);
        return;
    }

    const action_row = new MessageActionRow();
    const yes_button = new MessageButton({label: 'Yes', style: 'DANGER', customId: 'yes_button'});
    const no_button = new MessageButton({label: 'No', style: 'PRIMARY', customId: 'no_button'});

    action_row.addComponents(yes_button, no_button);


    const first_five = members.first(5).map((member) => member.user.tag);
    const member_preview = `${first_five.join('\n')} ${members.size > 5 ? `\nand ${members.size - 5} others` : ''}`;
    const opts = {
        embeds: [{
            title: 'Warning',
            description: `This will kick **${members.size}** members from **${msg.guild.name}** that joined in ` +
                         `the last **${timestr}** including:\n**${member_preview}**\n Are you sure you want to continue?`,
            color: 0xBA211C
        }],
        components: [action_row]
    };

    const interactable_message = await msg.channel.send(opts);
    const col = interactable_message.createMessageComponentCollector({time: 20000});

    const do_mass_kick = async (progress_message) => {
        bguild.temp_storage().set('massdabon_lock', true);

        let i = 0;
        await Promise.all(members.map(async (member) => { // It is critical that this never throws, otherwise the lock will never be unlocked
            if (!member.kickable)
                return;

            const [err] = await pledge(member.kick(reason));

            if (err)
                Logger.error(err);

            if (++i % 5 === 0) {
                progress_message.edit({embeds: [{
                    description: `Kicking members... (${i}/${members.size})`,
                    color: 0x259EF5
                }]}).catch(Logger.error);
            }
        }));

        bguild.temp_storage().set('massdabon_lock', false);
        msg.respond_info(`Finished kicking ${members.size} members.`);
    };

    col.on('collect', async (interaction) => {
        if (interaction.user.id !== msg.author.id)
            return;

        if (interaction.customId === 'yes_button') {
            col.stop('interact_yes');
            do_mass_kick(await interaction.reply({fetchReply: true, embeds: [{
                description: `Kicking members... (0/${members.size})`,
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
            msg.respond_info(`Massdabon prompt executed by ${msg.author.tag} timed out.`);
    });
};
