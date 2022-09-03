const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Pong';
module.exports.usage = '#PREFIXping';
module.exports.required_permissions = [''];
module.exports.args_list = {
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
    msg.respond_info(`Pong: \`${Math.floor(bot.client.ws.ping)}ms\``);
}
