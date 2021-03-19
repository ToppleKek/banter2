const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Display command help list';
module.exports.usage = '#PREFIXhelp';
module.exports.args_list =  {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'cmd',
        types: ['string']
    }]
};


/**
 * @param {Bot} bot Bot object that called
 * @param {Array} args Array of arguments 
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    bot.logger.debug(`help: got args: ${util.inspect(args)}`);
    msg.reply('Help me');
    // const pages  = [];
    // const 
    // for (let command of bot.commands) {

    // }
}
