const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');


function main(msg) {
    this.logger.debug('on message fired: msg.content: ' + msg.content);

    try {
        check_command(this, msg);
    } catch (err) {

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

    bot.logger.debug(`check_command: testing command: ${command_name}`);

    const command = bot.commands[command_name];
    if (!command)
        return;

    content = content.split(' ').slice(1).join(' ');

    bot.logger.debug(`check_command: message content: ${content}`);

    /*
        When you specify what args a command requires, use the format:
        name:type comma separated where type is: user_{id,mention},
        string, number, channel_{id,mention}, role_{id,mention}.
        State that the command's arguments are position independent by starting the
        args list with a !.
        Start an argument with a ? to specify an optional argument.
        Arguments can only be optional at the end of a sequence or when
        they are position independent (NOTE: optional arguments of the same type
        in a position independent args list will be read from left to right).

        EXAMPLES:
        (naenae command)
        usr:user,?reason:string
        (mute command)
        !usr:user,?time:number,?reason:string
    */
    // const tokens = [];
    // const arg_list_str = command.args.split('');
    // const arg_list = {
    //     position_independent: false,
    //     /*
    //         args objects will be defined by:
    //         arg: {
    //             name: string,
    //             optional: bool,
    //             type: string,

    //         }
    //     */
    //     args: []
    // };

    // if (arg_list_str[0] === '!')
    //     arg_list.position_independent = true;

    // for (let char of arg_list_str) {

    // }

    const tokens = [];
    let in_str = false;

    for (let i = 0; i < content.length; ++i) {
        if (content.charAt(i) !== ' ') {
            let buf = "";
            let num;

            while (content.charAt(i) !== ' ' && i < content.length)
                buf += content.charAt(i++);

            if (new RegExp(/^[0-9]{17,19}$/g).test(buf)) {
                if (bot.client.users.cache.get(buf))
                    tokens.push({ type: 'user_id', value: buf });
                else if (bot.client.channels.cache.get(buf))
                    tokens.push({ type: 'channel_id', value: buf });
                else if (msg.channel.messages.cache.get(buf))
                    tokens.push( {type: 'message_id', value: buf });
                else if (msg.guild.roles.cache.get(buf))
                    tokens.push( {type: 'role_id', value: buf });
                else
                    tokens.push({ type: 'id', value: buf }); // idk generic id could be a guild
            } else if (new RegExp(/^<@!?[0-9]{17,19}>$/g).test(buf))
                tokens.push({ type: 'user_mention', value: buf.replace(/<|@|!|>/g, '') });
            else if (new RegExp(/^<#[0-9]{17,19}>$/g).test(buf))
                tokens.push({ type: 'channel_mention', value: buf.replace(/<|#|>/g, '') });
            else if (new RegExp(/^<@&[0-9]{17,19}>$/g).test(buf))
                tokens.push({ type: 'role_mention', value: buf.replace(/<|@|&|>/g, '') });
            else if ((num = Number.parseFloat(buf)) == buf)
                tokens.push({ type: 'number', value: num });
            else
                tokens.push({ type: 'string', value: buf });
        }
    }

    bot.logger.debug(`check_command: parsed args to: ${util.inspect(tokens)}`);

    const args = new Map();

    if (commands.arg_list.position_independent) {
        for (let i = 0; i < tokens.length; ++i) {
            for (let j = 0; j < commands.arg_list.args; ++j) {
                if (commands.arg_list.args[j].type === tokens[i].type) {
                    args.set(commands.arg_list.args[j].name, tokens[i].value);
                    break;
                }
            }
        }
    } else {
        for (let i = 0; i < tokens.length; ++i) {
            if (commands.arg_list.args[i].type === tokens[i].type)
                args.set(commands.arg_list.args[i].name, tokens[i].value);
            else
                throw Error(`Expected type: ${commands.arg_list.args[i].type}` + 
                            `for argument: ${commands.arg_list.args[i].name}`  +
                            `but got: ${tokens[i].value} (${tokens[i].type}) instead`);
        }
    }

    if (args.size !== commands.arg_list.args.length)
        throw Error(`Expected ${command.arg_list.args.length} args but ${args.size} were provided`);

    command.main(bot, args, msg);
}

module.exports.main = main;