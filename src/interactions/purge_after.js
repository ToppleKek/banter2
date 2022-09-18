const CommandError = require('../command_error');
const Logger = require('../logger');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.name = 'Purge after this';
module.exports.type = 3;
module.exports.required_permissions = ['MANAGE_MESSAGES'];

/**
 * @param {Bot} bot Bot object that called
 * @param {Object} interaction The interaction
 */
module.exports.main = async (bot, guild, executor, interaction) => {
    Logger.debug('Purge after this interaction:');
    console.dir(interaction);

    let err, channel, msgs;

    [err, channel] = await pledge(guild.channels.fetch(interaction.channel_id));
    command_error_if(err, 'APIError');

    [err, msgs] = await pledge(channel.messages.fetch({ after: interaction.data.target_id }));
    command_error_if(err, 'APIError');

    if (msgs.size === 0)
        throw new CommandError('ArgumentError', 'There are no messages after this one.');

    [err] = await pledge(channel.bulkDelete(msgs));
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
