const Logger = require("../logger");
const { elide } = require("../utils/utils");

async function main(old_msg, new_msg) {
    const results = await Promise.allSettled([
        run_binds(this, new_msg)
    ]);

    for (const result of results) {
        if (result.status === 'rejected')
            Logger.error(`Event messageUpdate failed to run a task: ${result.reason}`);
    }
}

async function run_binds(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);
    const bind_msg = bguild.channel_bind_messages.get(msg.id);

    if (!bind_msg)
        return;

    const { bot_msg_id, webhook_id } = bind_msg;

    try {
        const webhook = await bot.client.fetchWebhook(webhook_id);
        const attachments = msg.attachments.map((a) => a.url).join('\n');
        const content = `${elide(msg.content, 1999 - attachments.length) ?? ''}\n${attachments}`;

        await webhook.editMessage(bot_msg_id, {
            username: msg.author.username,
            avatarURL: msg.author.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' }),
            content,
            allowedMentions: {users:[]}
        });
    } catch (err) {
        Logger.error(err);
    }
}

module.exports.main = main;
