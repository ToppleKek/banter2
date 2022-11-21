const BanterGuild = require('../banter_guild');
const Logger = require("../logger");

async function main(guild) {
    add_banter_guild(this, guild);
}

async function add_banter_guild(bot, guild) {
    Logger.info(`Joined new server. Setting up: ${guild.name} - ${guild.id}`);
    const bguild = new BanterGuild(bot, guild.id);

    await bguild._reload_config();
    bguild.temp_storage().set('spam_data', {});
    bot.guilds.set(guild.id, bguild);
}

module.exports.main = main;
