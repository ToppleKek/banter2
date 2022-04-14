const Logger = require("../logger");

function main(invite) {
    update_invite_store(this, invite);
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
