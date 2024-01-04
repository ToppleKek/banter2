const { Message } = require('discord.js');
const Bot = require('../bot');
const { pledge, command_error_if } = require('../utils/utils');
const fs = require('node:fs/promises');
const CONFIG = require('../../config.json');

module.exports.help = 'Clear all message dumps hosted on the server';
module.exports.usage = '#PREFIXpurgelogs';
module.exports.required_permissions = ['ADMINISTRATOR'];
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
    let [err, files] = await pledge(fs.readdir(`${CONFIG.msg_log_dir}/${msg.guild.id}`));
    command_error_if(err, 'IOError');

    for (const file of files) {
        [err] = await pledge(fs.rm(`${CONFIG.msg_log_dir}/${msg.guild.id}/${file}`));
        command_error_if(err, 'IOError');
    }

    msg.respond_info('Message dumps cleared.');
}
