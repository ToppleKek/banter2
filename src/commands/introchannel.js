const { Message, roleMention } = require('discord.js');
const Bot = require('../bot');
const { pledge } = require('../utils/utils');
const CommandError = require('../command_error');

module.exports.help = 'Toggle introduction channel. Call with no args to disable.';
module.exports.usage = '#PREFIXintrochannel <?channel>';
module.exports.required_permissions = ['MANAGE_CHANNELS'];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'channel',
        type: 'channel',
        description: 'The channel to handle introductions for. Omit this to disable (will delete managed role!)'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const bguild = bot.guilds.get(msg.guild.id);

    if (args.get('channel')) {
        let role_to_use;
        let [err, introduction_role] = await pledge(bguild.db_get('introduction_role'));

        // If there is already a role and we are just changing the channel, then keep the old role.
        // Otherwise, create a new one.
        if (!err && introduction_role)
            role_to_use = introduction_role;
        else {
            let [err, new_role] = await pledge(msg.guild.roles.create({ name: 'Introduced' }));
            role_to_use = new_role.id;
        }

        await pledge([bguild.db_set('introduction_channel', args.get('channel').id), bguild.db_set('introduction_role', role_to_use)]);
        msg.respond_info(`Introduction channel updated to ${args.get('channel').toString()} using role ${roleMention(role_to_use)}`);
    } else {
        let [err, introduction_role] = await pledge(bguild.db_get('introduction_role'));
        if (!err && introduction_role)
            await pledge(msg.guild.roles.delete(introduction_role));
        else
            throw new CommandError('ArgumentError', 'The introduction channel is currently disabled. Pass a channel to this command to enable it.');

        await pledge([bguild.db_set('introduction_channel', null), bguild.db_set('introduction_role', null)]);
        msg.respond_info('Disabled introduction channel');
    }
}
