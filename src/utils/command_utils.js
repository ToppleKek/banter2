const { Message } = require('discord.js');
const util = require('util');
const Bot = require('../bot');
const CommandError = require("../command_error");
const Utils = require('./utils');
const Logger = require('../logger');

module.exports = {
    join_token_string(i, tokens) {
        let buf = '';

        for (; i < tokens.length; ++i)
            buf += String(tokens[i].value) + ' ';

        return buf.trimEnd();
    },

    get_token(bot, msg, buf) {
        if (new RegExp(/^[0-9]{17,19}$/g).test(buf)) { // ID
            let ret;
            if (ret = bot.client.users.cache.get(buf))
                return { type: 'user', value: ret };
            else if (ret = bot.client.channels.cache.get(buf))
                return { type: 'channel', value: ret };
            else if (ret = msg.channel.messages.cache.get(buf))
                return { type: 'message', value: ret };
            else if (ret = msg.guild.roles.cache.get(buf))
                return { type: 'role', value: ret };
            else
                return { type: 'unknown_id', value: buf }; // idk generic id could be a guild
        } else if (new RegExp(/^<@!?[0-9]{17,19}>$/g).test(buf)) // USER MENTION
            return { type: 'user', value: bot.client.users.cache.get(buf.replace(/<|@|!|>/g, '')) };
        else if (new RegExp(/^<#[0-9]{17,19}>$/g).test(buf)) // CHANNEL MENTION
            return { type: 'channel', value: bot.client.channels.cache.get(buf.replace(/<|#|>/g, '')) };
        else if (new RegExp(/^<@&[0-9]{17,19}>$/g).test(buf)) // ROLE MENTION
            return { type: 'role', value: msg.guild.roles.cache.get(buf.replace(/<|@|&|>/g, '')) };
        else if ((num = Number.parseFloat(buf)) == buf)
            return { type: 'number', value: num };
        else
            return { type: 'string', value: buf, literal: false };
    },

    _try_cast(bot, msg, type, token_value) {
        let result;

        switch (type) {
            case 'user':
                result = bot.client.users.cache.find(user => user.username === token_value);

                if (result)
                    return { type: 'user', value: result };

                break;

            case 'channel':
                result = bot.client.channels.cache.find(channel => channel.name === token_value);

                if (result)
                    return { type: 'channel', value: result };

                break;

            case 'role':
                result = msg.guild.roles.cache.find(role => role.name === token_value);

                if (result)
                    return { type: 'role', value: result };
        }

        return { type: `failed_cast`, value: token_value };
    },

    /**
     *
     * @param {Bot} bot
     * @param {Message} msg
     * @param {Object} command
     * @param {Array} tokens
     */
    execute_command(bot, msg, command, tokens) {
        if (!Utils.check_permissions(msg.member, command.required_permissions)) {
            throw new CommandError('Permission Error',
                `You must have ${command.required_permissions.join(' or ')} to execute this command.`);
        }

        // Merge strings
        // [num, str, str, str, mention] -> [num, merged_string, mention]
        let buf = "";
        for (let i = 0; i < tokens.length; ++i) {
            if (tokens[i].type === 'string' && !tokens[i].literal) {
                let j = i;
                while (tokens[i] && tokens[i].type === 'string' && !tokens[i].literal)
                    buf += String(tokens[i++].value) + ' ';

                buf = buf.trimEnd();

                tokens[j] = { type: 'string', value: buf };
                tokens.splice(j + 1, i - j - 1);
            }
        }

        Logger.debug(`check_command: parsed args to: ${util.inspect(tokens)}\nargs needed: ${util.inspect(command.args_list)}`);

        const args = new Map();
        const optional_args = new Map();
        const cast_errors = [];

        if (command.args_list.position_independent) {
            for (let i = 0; i < tokens.length; ++i) {
                for (let j = 0; j < command.args_list.args.length; ++j) {
                    if (tokens[i].type === 'string' && command.args_list.args[j].type === 'string') {
                        args.set(command.args_list.args[i].name, module.exports.join_token_string(i, tokens));
                        break;
                    } else if (command.args_list.args[j].type === tokens[i].type) {
                        args.set(command.args_list.args[j].name, tokens[i].value);
                        break;
                    }
                }

                for (let j = 0; j < command.args_list.optional_args.length; ++j) {
                    if (tokens[i].type === 'string' && command.args_list.optional_args[j].type === 'string') {
                        args.set(command.args_list.optional_args[i].name, module.exports.join_token_string(i, tokens));
                        break;
                    } else if (command.args_list.optional_args[j].type === tokens[i].type) {
                        args.set(command.args_list.optional_args[j].name, tokens[i].value);
                        break;
                    }
                }
            }
        } else {
            let i;
            let j;
            for (i = 0, j = 0; j < command.args_list.args.length; ++j) {
                if (tokens.length <= i)
                    break;

                Logger.debug(`command_utils: ${command.args_list.args.length === 1 && command.args_list.optional_args.length === 0}`);
                // If there is only one argument required and it is a string, then just turn the whole message into a string.
                if (command.args_list.args.length === 1 && command.args_list.optional_args.length === 0 && command.args_list.args[j].type === 'string')
                    args.set(command.args_list.args[j].name, module.exports.join_token_string(i++, tokens));
                else if (command.args_list.args[j].type === 'string')
                    args.set(command.args_list.args[j].name, String(tokens[i++].value));
                else if (command.args_list.args[j].type === tokens[i].type)
                    args.set(command.args_list.args[j].name, tokens[i++].value);
                else if (tokens[i].type === 'string') {
                    const new_token = module.exports._try_cast(bot, msg, command.args_list.args[j].type, tokens[i].value);

                    if (new_token.type === 'failed_cast') {
                        throw new CommandError('SyntaxError', `Expected type: \`${command.args_list.args[j].type}\` ` +
                        `for argument: ${command.args_list.args[j].name} ` +
                        `but got: "${tokens[i].value}" (\`${tokens[i].type}\`) instead` +
                        `\nNOTE: Attempted implicit cast from: \`string\` ->` +
                            `\`${command.args_list.args[j].type}\` failed (not found)`);
                    }

                    tokens[i] = new_token;
                    args.set(command.args_list.args[j].name, tokens[i++].value);
                } else {
                    throw new CommandError('SyntaxError', `Expected type: \`${command.args_list.args[j].type}\` ` +
                        `for argument: ${command.args_list.args[j].name} `  +
                        `but got: "${tokens[i].value}" (\`${tokens[i].type}\`) instead`);
                }
            }

            for (j = 0; j < command.args_list.optional_args.length; ++j) {
                if (tokens.length <= i)
                    break;

                if (command.args_list.optional_args.length === 1 && command.args_list.optional_args[j].type === 'string')
                    optional_args.set(command.args_list.optional_args[j].name, module.exports.join_token_string(i++, tokens));
                else if (command.args_list.optional_args[j].type === tokens[i].type)
                    optional_args.set(command.args_list.optional_args[j].name, tokens[i++].value);
                else if (tokens[i].type === 'string') {
                    const new_token = module.exports._try_cast(bot, msg, command.args_list.optional_args[j].type, tokens[i].value);

                    if (new_token.type === 'failed_cast') {
                        msg.channel.send({embeds: [{
                            description: `Warning: Attempted implicit cast for argument \`${command.args_list.optional_args[j].name}\` ` +
                                         `from "${new_token.value}" (\`string\`) -> \`${command.args_list.optional_args[j].type}\` failed.`
                        }]});
                    } else {
                        tokens[i] = new_token;
                        optional_args.set(command.args_list.optional_args[j].name, tokens[i++].value);
                    }
                }
            }
        }

        if (args.size !== command.args_list.args.length)
            throw new CommandError('Argument Error', `Expected ${command.args_list.args.length} arguments but ${args.size} were provided`);

        Object.defineProperty(msg, 'command', { value: command });

        command.main(bot, new Map([...args, ...optional_args]), msg).catch((err) => {
            if (err instanceof CommandError)
                msg.respond_command_error(err.type, err.msg);
            else
                Logger.error(`execute_command (async): error: ${err}\n${err.stack}`);
        });
    }
}
