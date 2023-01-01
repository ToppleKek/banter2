const { Interaction } = require('../interactions');
const Logger = require('../logger');
const { pledge, command_error_if, elide } = require('../utils/utils');

module.exports.name = 'Tag this message...';
module.exports.type = 3;
module.exports.required_permissions = ['MODERATE_MEMBERS'];

/**
 * @param {Bot} bot Bot object that called
 * @param {import('discord.js').GuildMember} executor The member who executed this interaction
 * @param {import('discord.js').Message} target_msg The message this interaction was executed on
 * @param {Interaction} interaction The interaction
 */
module.exports.main = async (bot, executor, target_msg, interaction) => {
    const bguild = bot.guilds.get(target_msg.guild.id);
    let err, tags, response, collector;

    [err, tags] = await pledge(bguild.get_tags());
    const options = tags.map((tag) => ({ label: tag.key, value: tag.key, description: elide(tag.content, 50)}));
    const custom_id = `${interaction.id}_message_components`;
    [err, {response, collector}] = await pledge(interaction.respond({
        type: 4,
        data: {
            content: 'Select a tag to attach to the selected message:',
            components: [{
                type: 1,
                components: [{
                    type: 3,
                    custom_id: custom_id,
                    options,
                    placeholder: 'Select a tag...',
                    min_values: 1,
                    max_values: 1
                }]
            }],
            flags: 1 << 6
        }
    }, custom_id, 30 * 1000));

    command_error_if(err, 'APIError');
    collector.once('collect', async ({interaction: followup_interaction, data}) => {
        const context_link = `https://discord.com/channels/${target_msg.guild.id}/${target_msg.channel.id}/${target_msg.id}`;
        const [errs] = await pledge([
            followup_interaction.respond({
                type: 7,
                data: {
                    content: null,
                    components: [],
                    embeds: [{
                        description: `Tagged selected message with: \`${data.values[0]}\``,
                        color: 0x259EF5
                    }],
                    flags: 1 << 6
                },
            }),
            target_msg.reply(tags.find((tag) => tag.key === data.values[0]).content),
            bguild.mod_log(`tag with ${data.values[0]}`, executor.user, target_msg.author, `[Jump to Context](${context_link})`)
        ]);

        collector.stop();
        command_error_if(errs, 'APIError');
    });

    collector.once('stop', async (reason) => {
        if (reason !== 'timeout')
            return;

        interaction.edit_message({
            content: null,
            components: [],
            embeds: [{
                description: 'Timed out.',
                color: 0x259EF5
            }],
        });
    });
}
