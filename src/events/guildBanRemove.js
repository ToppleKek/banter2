const Logger = require('../logger');

async function main(ban) {
    cancel_temp_ban(this, ban);
}

function cancel_temp_ban(bot, ban) {
    bot.guilds.get(ban.guild.id).remove_temp_ban(ban.user.id, false).catch(Logger.error);
    Logger.info(`Attempting to cancel any temp ban on ${ban.guild.id} for ${ban.user.id}: manually unbanned`);
}

module.exports.main = main;
