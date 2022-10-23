const { pledge } = require("../utils/utils");

function main(msg) {
    relog(this, msg);
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

module.exports.main = main;
