const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const CommandError = require("../command_error");
const CommandUtils = require("../utils/command_utils");
const Logger = require("../logger");

async function main(msg) {
    if (msg.author.bot || !msg.guild)
        return;

    try {
        await check_command(this, msg);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
        else
            Logger.error(`command_handler: error: ${err}\n${err.stack}`);
    }

    update_unique_authors(this, msg);
}

async function update_unique_authors(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);
    bguild.add_unique_author(msg.author.id);
}

/**
 * Check a message for a command and execute it if found
 * @param {Bot} bot the bot
 * @param {Message} msg the message to check
 */
async function check_command(bot, msg) {
    if (!msg.guild || msg.author.id === bot.client.user.id || msg.author.bot || !msg.content.startsWith(bot.prefix))
        return;

    let content = msg.content.substring(bot.prefix.length);
    const split_content = content.split(' ');
    const command_name = split_content[0];

    const command = bot.commands[command_name];
    if (!command)
        return;

    content = split_content.slice(1).join(' ');

    const tokens = [];

    for (let i = 0; i < content.length; ++i) {
        if (content.charAt(i) !== ' ') {
            let buf = "";

            if (content.charAt(i) === '"') {
                i++;
                while (content.charAt(i) !== '"') {
                    buf += content.charAt(i++);

                    if (i >= content.length)
                        throw new CommandError('SyntaxError', 'Missing closing quote');
                }

                tokens.push({ type: 'string', value: buf, literal: true });
                // skip closing quote
                continue;
            }

            while (content.charAt(i) !== ' ' && i < content.length)
                buf += content.charAt(i++);

            const t = (await CommandUtils.get_token(bot, msg, buf)) || null;

            // TODO: I don't really know if I want to pass null users around. Is it better than passing around an invalid ID and
            // making the command do all the checking every time? idk
            // if (!t)
            //     throw new CommandError('ArgumentError', `Unexpected null token: invalid mention`);

            tokens.push(t);
        }
    }

    CommandUtils.execute_command(bot, msg, command, tokens);
}

module.exports.main = main;
