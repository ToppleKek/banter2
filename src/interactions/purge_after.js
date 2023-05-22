const CommandError = require('../command_error');
const Logger = require('../logger');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.name = 'Purge after this';
module.exports.type = 3;
module.exports.required_permissions = ['MANAGE_MESSAGES'];

/**
 * @param {Bot} bot Bot object that called
 * @param {import('discord.js').GuildMember} executor The member who executed this interaction
 * @param {import('discord.js').Message} target_msg The message this interaction was executed on
 * @param {Object} interaction The interaction
 */
module.exports.main = async (bot, executor, target_msg, interaction) => {
    const bguild = bot.guilds.get(target_msg.guild.id);
    let err, msgs, log_id;
    [err, log_id] = await pledge(bguild.db_get('log'));

    if (bguild.config_get('logNoP') && !err && log_id === target_msg.channel.id)
        throw new CommandError('PermissionError', 'This command is disabled in this channel.');

    [err, msgs] = await pledge(target_msg.channel.messages.fetch({ after: target_msg.id }));
    command_error_if(err, 'APIError');

    if (msgs.size === 0)
        throw new CommandError('ArgumentError', 'There are no messages after this one.');

    [err] = await pledge(target_msg.channel.bulkDelete(msgs));
    command_error_if(err, 'APIError');

    interaction.respond({
        type: 4,
        data: {
            embeds: [{
                description: `Purged ${msgs.size} messages`,
                color: 0x259EF5
            }],
            flags: 1 << 6
        }
    });
}
