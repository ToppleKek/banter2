const Logger = require("../logger");
const { pledge } = require("../utils/utils");

async function main(msg) {
    const results = await Promise.allSettled([
        relog(this, msg),
        run_binds(this, msg)
    ]);

    for (const result of results) {
        if (result.status === 'rejected')
            Logger.error(`Event messageDelete failed to run a task: ${result.reason}`);
    }
}

async function relog(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);

    if (!bguild.config_get('logNoD'))
        return;

    const [err, log_id] = await pledge(bguild.db_get('log'));

    if (err || !log_id)
        return;

    if (msg.channel.id === log_id && msg.author.id === bot.client.user.id)
        bguild.log(msg.embeds[0], msg.author.id);
}

async function run_binds(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);
    const bind_msg = bguild.channel_bind_messages.get(msg.id);

    if (!bind_msg)
        return;

    const { bot_msg_id, webhook_id } = bind_msg;

    if (!bot_msg_id || !webhook_id)
        return;

    try {
        const webhook = await bot.client.fetchWebhook(webhook_id);
        await webhook.deleteMessage(bot_msg_id);
    } catch (err) {
        Logger.error(err);
    } finally {
        bguild.channel_bind_messages.delete(msg.id);
    }
}

module.exports.main = main;
