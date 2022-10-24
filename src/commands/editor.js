const { Message } = require("discord.js");
const Bot = require("../bot");
const { pledge, command_error_if } = require("../utils/utils");

module.exports.help = 'Get a link to the web editor';
module.exports.usage = '#PREFIXeditor';
module.exports.required_permissions = [];
module.exports.args_list =  {
    position_independent: false,
    args: [],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const [err, config] = await pledge(bot.guilds.get(msg.guild.id).db_get('config'));
    command_error_if(err, 'SQLError');

    msg.respond_info(`[Open web editor](https://editor.topplekek.xyz/?cfg=${config})`);
}
