const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const CommandError = require("../command_error");


function main(msg) {
    try {
        check_command(this, msg);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
    }
}

function join_token_string(i, tokens) {
    let buf;
    
    for (; i < tokens.length; ++i) {
        if (tokens[i].type === 'string')
            buf += new String(token[i].value);
        else
            break;
    }

    return buf;
}

function get_token(buf) {
    
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
    // const arg_list_str = command.args_list.split('');
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
                    tokens.push({ type: 'unknown_id', value: buf }); // idk generic id could be a guild
            } else if (new RegExp(/^<@!?[0-9]{17,19}>$/g).test(buf))
                tokens.push({ type: 'user_mention', value: buf.replace(/<|@|!|>/g, '') });
            else if (new RegExp(/^<#[0-9]{17,19}>$/g).test(buf))
                tokens.push({ type: 'channel_mention', value: buf.replace(/<|#|>/g, '') });
            else if (new RegExp(/^<@&[0-9]{17,19}>$/g).test(buf))
                tokens.push({ type: 'role_mention', value: buf.replace(/<|@|&|>/g, '') });
            else if ((num = Number.parseFloat(buf)) == buf)
                tokens.push({ type: 'number', value: num });
            else {
                tokens.push({ type: 'string', value: buf });
            }

        }
    }

    bot.logger.debug(`check_command: parsed args to: ${util.inspect(tokens)}\nargs needed: ${util.inspect(command.args_list)}`);

    const args = new Map();
    const optional_args = new Map();

    if (command.args_list.position_independent) {
        for (let i = 0; i < tokens.length; ++i) {
            for (let j = 0; j < command.args_list.args.length; ++j) {
                if (token[i].type === 'string' && command.args_list.args[j].types.includes('string')) {
                    args.set(command.args_list.args[i].name, join_token_string(i, tokens));
                    break;
                } else if (command.args_list.args[j].types.includes(tokens[i].type)) {
                    args.set(command.args_list.args[j].name, tokens[i].value);
                    break;
                }
            }
        }
    } else {
        let i;
        for (i = 0; i < tokens.length; ++i) {
            if (command.args_list.args.length <= i)
                break;
            if (command.args_list.args[i].types.length === 1 && command.args_list.args[i].types[0] === 'string')
                args.set(command.args_list.args[i].name, join_token_string(tokens));
            else if (command.args_list.args[i].types.includes(tokens[i].type))
                args.set(command.args_list.args[i].name, tokens[i].value);
            else
                throw new CommandError('SyntaxError', `Expected type: ${command.args_list.args[i].types.join(' or ')} ` + 
                            `for argument: ${command.args_list.args[i].name} `  +
                            `but got: ${tokens[i].value} (${tokens[i].type}) instead`);
        }

        for (let j = 0; i < tokens.length; ++i, ++j) {
            if (command.args_list.optional_args.length <= i)
                break;
            if (command.args_list.optional_args[j].types.length === 1 && command.args_list.optional_args[j].types[0] === 'string')
                optional_args.set(command.args_list.optional_args[j].name, new String(tokens[i].value));
            else if (command.args_list.optional_args[j].types.includes(tokens[i].type))
                optional_args.set(command.args_list.optional_args[j].name, tokens[i].value);
        }
    }

    if (args.size !== command.args_list.args.length)
        throw new CommandError('Argument Error', `Expected ${command.args_list.args.length} args but ${args.size} were provided`);

    command.main(bot, new Map([...args, ...optional_args]), msg);
}

module.exports.main = main;