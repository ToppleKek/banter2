const { Message } = require("discord.js");
const Bot = require("../bot");
const Logger = require("../logger");
const { pledge, command_error_if } = require("../utils/utils");

module.exports.help = 'Get info about a user';
module.exports.usage = '#PREFIXinfo <user>';
module.exports.required_permissions = ['ADMINISTRATOR'];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'config',
        type: 'string',
        description: 'B64 config string from web editor'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const [err] = await pledge(bot.guilds.get(msg.guild.id)._load_new_config(args.get('config')));
    command_error_if(err, 'ArgumentError');

    msg.respond_info('Server configuration updated');
}
