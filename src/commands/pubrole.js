const { Message } = require('discord.js');
const Bot = require('../bot');
const CommandError = require('../command_error');
const { pledge, command_error_if } = require('../utils/utils');

module.exports.help = 'Role yourself';
module.exports.usage = '#PREFIXpubrole <pubrole>';
module.exports.required_permissions = [];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'pubrole',
        type: 'role',
        description: 'Public role to get'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);
    const pubrole = args.get('pubrole');
    const [err, pubroles] = await pledge(bguild.get_pub_roles());

    if (err)
        throw new CommandError('UnknownError', err.toString());

    if (!pubrole) {
        const [err, fetched_pubroles] = await pledge(Promise.all(pubroles.map(async (p) => ({role: await msg.guild.roles.fetch(p), id: p}))));
        command_error_if(err, 'APIError');

        const human_roles = fetched_pubroles.map((p) => {
            if (!p.role) {
                bguild.toggle_pub_role(p.id);
                return null;
            }

            return p.role.name;
        }).filter((p) => p !== null);

        msg.respond_info(`${human_roles.join('\n') || '**None.**'}`, `Public roles for ${msg.guild.name}`);
        return;
    }

    if (!pubroles.includes(pubrole.id)) {
        msg.respond_error('That role is not public.');
        return;
    }

    const member = msg.guild.members.resolve(msg.author);
    const add = !member.roles.cache.has(pubrole.id);

    if (add)
        member.roles.add(pubrole);
    else
        member.roles.remove(pubrole);

    msg.respond_info(`You ${add ? 'now' : 'no longer'} have the \`${pubrole.name}\` role.`);
}
