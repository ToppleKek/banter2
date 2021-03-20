const util = require('util');
const CommandError = require("../command_error");

module.exports = {
    join_token_string(i, tokens) {
        let buf = '';
        
        for (; i < tokens.length; ++i)
            buf += new String(tokens[i].value) + ' ';
    
        return buf.trimEnd();
    },

    get_token(bot, buf) {
        if (new RegExp(/^[0-9]{17,19}$/g).test(buf)) {
            if (bot.client.users.cache.get(buf))
                return { type: 'user', value: buf };
            else if (bot.client.channels.cache.get(buf))
                return { type: 'channel', value: buf };
            else if (msg.channel.messages.cache.get(buf))
                return  {type: 'message', value: buf };
            else if (msg.guild.roles.cache.get(buf))
                return  {type: 'role', value: buf };
            else
                return { type: 'unknown_id', value: buf }; // idk generic id could be a guild
        } else if (new RegExp(/^<@!?[0-9]{17,19}>$/g).test(buf))
            return { type: 'user', value: buf.replace(/<|@|!|>/g, '') };
        else if (new RegExp(/^<#[0-9]{17,19}>$/g).test(buf))
            return { type: 'channel', value: buf.replace(/<|#|>/g, '') };
        else if (new RegExp(/^<@&[0-9]{17,19}>$/g).test(buf))
            return { type: 'role', value: buf.replace(/<|@|&|>/g, '') };
        else if ((num = Number.parseFloat(buf)) == buf)
            return { type: 'number', value: num };
        else
            return { type: 'string', value: buf };
    },

    execute_command(bot, msg, command, tokens) {
        // Merge strings
        // [num, str, str, str, mention] -> [num, merged_string, mention]
        let buf = "";
        for (let i = 0; i < tokens.length; ++i) {
            if (tokens[i].type === 'string') {
                let j = i;
                while (tokens[i] && tokens[i].type === 'string')
                    buf += new String(tokens[i++].value) + ' ';

                buf = buf.trimEnd();

                tokens[j] = { type: 'string', value: buf };
                tokens.splice(j + 1, i - j - 1);
            }
        }

        bot.logger.debug(`check_command: parsed args to: ${util.inspect(tokens)}\nargs needed: ${util.inspect(command.args_list)}`);

        const args = new Map();
        const optional_args = new Map();

        if (command.args_list.position_independent) {
            for (let i = 0; i < tokens.length; ++i) {
                for (let j = 0; j < command.args_list.args.length; ++j) {
                    if (token[i].type === 'string' && command.args_list.args[j].type === 'string') {
                        args.set(command.args_list.args[i].name, module.exports.join_token_string(i, tokens));
                        break;
                    } else if (command.args_list.args[j].type === tokens[i].type) {
                        args.set(command.args_list.args[j].name, tokens[i].value);
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
                
                // If there is only one argument required and it is a string, then just turn the whole message into a string.
                if (command.args_list.args.length === 1 && command.args_list.args[j].type === 'string')
                    args.set(command.args_list.args[j].name, module.exports.join_token_string(i++, tokens));
                else if (command.args_list.args[j].type === 'string')
                    args.set(command.args_list.args[i].name, new String(tokens[i++].value));
                else if (command.args_list.args[j].type === tokens[i].type)
                    args.set(command.args_list.args[j].name, tokens[i++].value);
                else
                    throw new CommandError('SyntaxError', `Expected type: ${command.args_list.args[j].type} ` + 
                                `for argument: ${command.args_list.args[j].name} `  +
                                `but got: ${tokens[i].value} (${tokens[i].type}) instead`);
            }

            for (j = 0; j < command.args_list.optional_args.length; ++j) {
                if (tokens.length <= i)
                    break;

                if (command.args_list.optional_args.length === 1 && command.args_list.optional_args[j].type === 'string')
                    optional_args.set(command.args_list.optional_args[j].name, module.exports.join_token_string(i++, tokens));
                else if (command.args_list.optional_args[j].type === tokens[i].type)
                    optional_args.set(command.args_list.optional_args[j].name, tokens[i++].value);
            }
        }

        if (args.size !== command.args_list.args.length)
            throw new CommandError('Argument Error', `Expected ${command.args_list.args.length} args but ${args.size} were provided`);

        command.main(bot, new Map([...args, ...optional_args]), msg);
    }
}