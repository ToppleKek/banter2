const { Message } = require("discord.js");
const Bot = require("../bot");

module.exports.help = 'Display command help list';
module.exports.usage = '#PREFIXhelp';
module.exports.args =  {
    position_independent: false,
    args: [{
        name: 'cmd',
        optional: true,
        type: 'string'
    }]
};


/**
 * @param {Bot} bot Bot object that called
 * @param {Array} args Array of arguments 
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    msg.reply('Help me');
    // const pages  = [];
    // const 
    // for (let command of bot.commands) {

    // }
}
