const { Message } = require("discord.js");
const Bot = require("../bot");
const Utils = require('../utils/utils')

module.exports.help = 'Get a user\'s avatar';
module.exports.usage = '#PREFIXavatar @TopKek';
module.exports.required_permissions = [];
module.exports.args_list = {
    position_independent: false,
    args: [],
    optional_args: [{
        name: 'user',
        type: 'user',
        description: 'User to get the avatar of'
    }]
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    const user = args.get('user') || msg.author;
    const embed = {
        title: `${user.username}#${user.discriminator}'s avatar`,
        image: {
            url: user.avatarURL({ size: 4096, dynamic: true, format: 'png' })
        }
    };

    await msg.channel.send({embed});
}
