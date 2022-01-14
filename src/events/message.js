const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const CommandError = require("../command_error");
const CommandUtils = require("../utils/command_utils");
const Logger = require("../logger");

const subscribed_macros = [];
const macro_errors = new Map();

function main(msg) {
    try {
        check_command(this, msg);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
        else
            Logger.error(`command_handler: error: ${err}\n${err.stack}`);
    }
}

function _get_value(value, bot, msg) {
    switch (value) {
        case 'content':
            return msg.content;
        case 'author_name':
            return msg.author.name;
        default:
            return null;
    }
}

function _add_error(guild, macro_name, error) {
    if (!macro_errors.has(guild))
        macro_errors.set(guild, []);

    macro_errors.get(guild).push({
        macro_name,
        error,
        last_run: Date.now()
    });
}

function subscribe(guild, macro) {
    subscribed_macros.push({
        guild,
        payload: macro
    });
}

async function _execute_macro(bot, macro) {
    const payload = macro.payload;

    let last_logic_op;
    let last_result = true;
    let evaluated_conditionals = [];

    for (const conditional of payload.conditionals) {
        const lhs = _get_value(conditional.lhs_src, bot, msg);

        if (!lhs) {
            _add_error(macro.guild, payload.name, `Invalid lhs source: ${conditional.lhs_src}`);
            continue;
        }

        let result;
        let not = conditional.operator.startsWith('!');

        if (not)
            conditional.operator = conditional.operator.substring(1);
        
        switch (conditional.operator) {
            case 'equals':
                result = lhs === conditional.rhs && !not;
                break;
            case 'contains':
                if (typeof lhs !== 'string' || typeof conditional.rhs !== 'string') {
                    _add_error(macro.guild, payload.name, 'Operator "contains" requires two string operands');
                    return;
                }

                result = lhs.includes(conditional.rhs);
                console.log(`contains operator lhs=${lhs} rhs=${conditional.rhs} result=${result}`);
                break;
            default:
                _add_error(macro.guild, payload.name, 'Unimplemented or unknown operator: ' + conditional.operator);
                return;
        }

        evaluated_conditionals.push({is_literal: true, value: result});

        if (conditional.logic_op !== '')
            evaluated_conditionals.push({is_literal: false, value: conditional.logic_op});

        // switch (last_logic_op) {
        //     case 'and':
        //         if (!last_result || !result) {
        //             last_result = false;
        //             last_logic_op = conditional.logic_op;
        //             continue;
        //         }

        //         last_result = true;
        //         last_logic_op = conditional.logic_op;
        //         break;
        //     case 'or':
        //         if (!last_result && !result) {
        //             last_result = false;
        //             last_logic_op = conditional.logic_op;
        //             continue;
        //         }

        //         last_result = true;
        //         last_logic_op = conditional.logic_op;
        // }
    }

    while (evaluated_conditionals.length > 1) {
        console.dir(evaluated_conditionals);
        let lhs;
        let operator;
        let rhs;

        if (evaluated_conditionals[0].is_literal)
            lhs = evaluated_conditionals[0].value;
        
        if (!evaluated_conditionals[1].is_literal)
            operator = evaluated_conditionals[1].value;
        
        if (evaluated_conditionals[2].is_literal)
            rhs = evaluated_conditionals[2].value;

        evaluated_conditionals = evaluated_conditionals.slice(2);

        switch (operator) {
            case 'and':
                evaluated_conditionals[0] = {is_literal: true, value: lhs && rhs};
                break;
        
            case 'or':
                evaluated_conditionals[0] = {is_literal: true, value: lhs || rhs};
                break;
        }
    }

    if (!evaluated_conditionals[0].value)
        return;

    for (const response of payload.responses) {
        switch (response.action) {
            case 'send_message':
                const channel = await bot.channels.fetch(response.args[0])
                .catch((err) => _add_error(macro.guild, payload.name, `Could not fetch channel: ${err}`));

                await channel.send(response.args[1])
                .catch((err) =>_add_error(macro.guild, payload.name, `Could not send message: ${err}`));
                break;
            default:
                _add_error(macro.guild, payload.name, `Unimplemented or unknown action type: ${response.action}`);
                return;
        }
    }
}

function execute_macros(bot, msg) {
    for (const macro of subscribed_macros)
        _execute_macro(bot, macro);


    //macro_loop:
    // for (const macro of subscribed_macros) {
    //     const payload = macro.payload;

    //     bot.logger.info(`execute_macros (event=message): executing macro: ${payload.name} on guild: ${macro.guild}`);

    //     let last_logic_op;
    //     let last_result = true;
    //     let evaluated_conditionals = [];
    //     for (const conditional of payload.conditionals) {
    //         const lhs = _get_value(conditional.lhs_src, bot, msg);

    //         if (!lhs) {
    //             _add_error(macro.guild, payload.name, `Invalid lhs source: ${conditional.lhs_src}`);
    //             continue;
    //         }

    //         let result;
    //         let not = conditional.operator.startsWith('!');

    //         switch (conditional.operator) {
    //             case 'equals':
    //                 console.log(`equals operator lhs=${lhs} rhs=${conditional.rhs}`);
    //                 result = lhs === conditional.rhs && !not;
    //                 break;
    //             case 'contains':
    //                 console.log(`contains operator lhs=${lhs} rhs=${conditional.rhs}`);
    //                 if (typeof lhs !== 'string' || typeof conditional.rhs !== 'string') {
    //                     _add_error(macro.guild, payload.name, 'Operator "contains" requires two string operands');
    //                     continue macro_loop;
    //                 }
    //                 break;
    //             default:
    //                 _add_error(macro.guild, payload.name, 'Unimplemented or unknown operator');
    //                 continue macro_loop;
    //         }

    //         evaluated_conditionals.push({is_literal: true, value: result});

    //         if (conditional.logic_op !== '')
    //             evaluated_conditionals.push({is_literal: false, value: conditional.logic_op});
    //     }
        
    //     while (evaluated_conditionals.length > 1) {
    //         console.dir(evaluated_conditionals);
    //         let lhs;
    //         let operator;
    //         let rhs;
        
    //         if (evaluated_conditionals[0].is_literal)
    //             lhs = evaluated_conditionals[0].value;
            
    //         if (!evaluated_conditionals[1].is_literal)
    //             operator = evaluated_conditionals[1].value;
            
    //         if (evaluated_conditionals[2].is_literal)
    //             rhs = evaluated_conditionals[2].value;
        
    //         evaluated_conditionals = evaluated_conditionals.slice(2);
        
    //         switch (operator) {
    //             case 'and':
    //                 evaluated_conditionals[0] = {is_literal: true, value: lhs && rhs};
    //                 break;
            
    //             case 'or':
    //                 evaluated_conditionals[0] = {is_literal: true, value: lhs || rhs};
    //                 break;
    //         }
    //     }
        
    // }
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

            const t = CommandUtils.get_token(bot, msg, buf) || null;

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
