const Logger = require("../logger");
const { pledge } = require("../utils/utils");

function main(member) {
    apply_auto_roles(this, member);
}

async function apply_auto_roles(bot, member) {
    const b_guild = bot.guilds.get(member.guild.id);
    const [err, auto_roles] = await pledge(b_guild.get_auto_roles());

    if (err) {
        Logger.error(err);
        return;
    }

    for (const role of auto_roles) {
        member.roles.add(role).catch((err) => {
            if (err instanceof TypeError) {
                // This role probably doesn't exist anymore so lets just remove it
                Logger.warn(`apply_auto_roles: TypeError while applying autorole: role=${role} err=${err} -- removing this role from the list`);
                b_guild.remove_auto_role(role).catch(Logger.error);
            } else
                Logger.error(`apply_auto_roles: error applying autorole: role=${role} err=${err}`);
        });
    }
}

module.exports.main = main;
