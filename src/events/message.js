const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const CommandError = require("../command_error");
const CommandUtils = require("../utils/command_utils");


function main(msg) {
    try {
        check_command(this, msg);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
        else
            this.logger.error(`command_handler: error: ${err}`);
    }
}

/**
 * Check a message for a command and execute it if found
 * @param {Bot} bot the bot
 * @param {Message} msg the message to check
 */
function check_command(bot, msg) {
    if (!msg.guild || msg.author.id === bot.client.user.id || msg.author.bot || !msg.content.startsWith(bot.prefix))
        return;

    let content = msg.content.substring(bot.prefix.length);
    const command_name = content.split(' ')[0];

    const command = bot.commands[command_name];
    if (!command)
        return;

    content = content.split(' ').slice(1).join(' ');

    const tokens = [];
    let in_str = false;

    for (let i = 0; i < content.length; ++i) {
        if (content.charAt(i) !== ' ') {
            let buf = "";
            let num;

            if (content.charAt(i) === '"') {
                i++;
                while (content.charAt(i) !== '"') {
                    buf += content.charAt(i++);

                    if (i >= content.length)
                        throw new CommandError('SyntaxError', 'Missing closing quote');
                }

                tokens.push({ type: 'string', value: buf });
                // skip closing quote
                continue;
            }

            while (content.charAt(i) !== ' ' && i < content.length)
                buf += content.charAt(i++);

            tokens.push(CommandUtils.get_token(bot, buf));
        }
    }

    CommandUtils.execute_command(bot, msg, command, tokens);
}

module.exports.main = main;