const { elide, pledge, command_error_if } = require('../utils/utils');

module.exports.name = 'View notes';
module.exports.type = 2;
module.exports.required_permissions = ['MANAGE_MESSAGES'];

/**
 * @param {Bot} bot Bot object that called
 * @param {import('discord.js').GuildMember} executor The member who executed this interaction
 * @param {import('discord.js').Message} target_member The member this interaction was executed on
 * @param {Object} interaction The interaction
 */
module.exports.main = async (bot, executor, target_member, interaction) => {
    let err, notes;
    [err, notes] = await pledge(bot.db.allp('SELECT * FROM notes WHERE user_id = ?', target_member.user.id));
    command_error_if(err, 'SQLError');

    let i = 0;
    let fields = await Promise.all(notes.map(async (note) => {
        const [err, author] = await pledge(bot.client.users.fetch(note.author_id));
        command_error_if(err, 'APIError');

        return {
            name: `${++i} - ${author.tag}`,
            value: elide(note.content, 1024)
        };
    }));

    let diff = fields.length - 10;
    fields = fields.splice(0, 10);

    const embed = {
        color: 0x9284FA,
        title: `Notes for ${target_member.user.tag}`,
        fields,
        footer: {
            text: `To view ${diff > 0 ? ` the remaining ${diff} notes` : ' details'} or edit notes, use the \`notes\` command`
        }
    };

    interaction.respond({
        type: 4,
        data: {
            embeds: [embed],
            flags: 1 << 6
        }
    });
}
