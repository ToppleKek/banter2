const { pledge, command_error_if, elide } = require('../utils/utils');
const UUID = require('uuid');

module.exports.name = 'Add note...';
module.exports.type = 2;
module.exports.required_permissions = ['MANAGE_MESSAGES'];

/**
 * @param {Bot} bot Bot object that called
 * @param {import('discord.js').GuildMember} executor The member who executed this interaction
 * @param {import('discord.js').GuildMember} target_member The member this interaction was executed on
 * @param {Object} interaction The interaction
 */
module.exports.main = async (bot, executor, target_member, interaction) => {
    const [err, modal_interaction] = await pledge(interaction.respond_modal(`New note for ${elide(target_member.user.username, 17)}`, [{
        type: 4,
        custom_id: 'note_content',
        label: 'Note Content',
        placeholder: `Something about ${target_member.user.username}...`,
        style: 2,
        min_length: 1,
        max_length: 2000,
        required: true,
    }]));

    command_error_if(err, 'APIError');

    modal_interaction.once('submit', async (submission) => {
        const [err] = await pledge(bot.db.runp(
            'INSERT INTO notes (user_id, author_id, guild_id, content, timestamp, id) VALUES (?, ?, ?, ?, ?, ?)',
            target_member.user.id,
            executor.user.id,
            executor.guild.id,
            submission.components[0].value,
            Date.now().toString(),
            UUID.v4()
        ));

        command_error_if(err, 'SQLError');

        await submission.interaction.respond({
            type: 4,
            data: {
                embeds: [{
                    description: `Added note to **${target_member.user.tag}**: \`${elide(submission.components[0].value, 700)}\``,
                    color: 0x259EF5
                }],
                flags: 1 << 6
            },
        });
    });

}
