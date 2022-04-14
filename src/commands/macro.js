const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');
const SCHEMA = require('../macro_schema.json');
const Ajv = require('ajv');
const CommandError = require("../command_error");
const Validate = new Ajv({ allErrors: true }).compile(SCHEMA);

const DEFAULT_MACRO_ROW = {
    macros: []
};

module.exports.help = 'Setup server macros';
module.exports.usage = '#PREFIXmacro <command> <args...>';
module.exports.required_permissions = ['ADMINISTRATOR'];
module.exports.args_list =  {
    position_independent: false,
    args: [{
        name: 'command',
        type: 'string',
        description: 'One of "new", "load", "delete"'
    }, {
        name: 'command_args',
        type: 'string',
        description: 'Arguments for the `command`'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    switch (args.command) {
        case 'new':
            new_macro(bot, msg, args.command_args);
            break;

        case 'load':
            try {
                const macro_object = JSON.parse(atob(args.command_args));
                if (!Validate(macro_object))
                    throw new CommandError('Argument Error', 'Invalid macro');
                
                load_macro(bot, msg, macro_object).then(() => {
                    msg.respond_info(`Macro loaded successfully`);
                }).catch((err) => {
                    msg.respond_command_error('Unknown Error', err)
                });

            } catch (err) {
                throw new CommandError('Argument Error', 'JSON parse failure');
            }
            break;

        case 'delete':
            delete_macro(bot, msg, args.command_args);
            break;

        default:
            throw new CommandError('Argument Error', 'Invalid command');
    }
}


function new_macro(bot, msg, name) {
    msg.respond_info(`[Open Macro Editor] (https://editor.topplekek.xyz/macro?name=${name})`);
}

async function load_macro(bot, msg, macro) {
    const guild = bot.guilds.get(msg.guild.id);
    const guild_macros = JSON.parse(await guild.db_get('macros')) || DEFAULT_MACRO_ROW;

    guild_macros.macros.push(macro);
    await guild.db_set('macros', JSON.stringify(guild_macros));
}

function delete_macro(bot, msg, name) {

}
