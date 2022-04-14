const Logger = require("../logger");

function main(member) { 
    apply_auto_roles(this, member);
}

async function apply_auto_roles(bot, member) {
    const b_guild = bot.guilds.get(member.guild.id);
    const auto_roles = await b_guild.get_auto_roles();

    for (const role of auto_roles) {
        member.roles.add(role).catch((err) => {
            if (err instanceof TypeError) {
                // This role probably doesn't exist anymore so lets just remove it
                Logger.warn(`apply_auto_roles: TypeError while applying autorole: role=${role} err=${err} -- removing this role from the list`);
                b_guild.remove_auto_role(role);
            } else
                Logger.error(`apply_auto_roles: error applying autorole: role=${role} err=${err}`);
        });
    }
}

module.exports.main = main;
