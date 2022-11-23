const Logger = require("../logger");

async function main(invite) {
    try {
        update_invite_store(this, invite);
    } catch (err) {
        Logger.error(`Failed to update invite store: ${err}`);
    }
}

/**
 * Add any new invites created to the invite store
 * @param {Bot} bot
 * @param {Discord.Invite} invite
 */
function update_invite_store(bot, invite) {
    Logger.debug(`Updating invite store on guild=${invite.guild.id} new invite=${invite.code}`);
    const bguild = bot.guilds.get(invite.guild.id);

    bguild.invites().set(invite.code, {
        code: invite.code,
        inviter: invite.inviter,
        uses: invite.memberCount,
    });
}

module.exports.main = main;
