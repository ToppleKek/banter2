const { Message } = require("discord.js");
const Bot = require("../bot");
const util = require('util');

module.exports.help = 'Evaluate JS';
module.exports.usage = '#PREFIXevaljs <code>';
module.exports.required_permissions = ['BOT_OWNER'];
module.exports.args_list = {
    position_independent: false,
    args: [{
        name: 'code',
        type: 'string',
        description: 'Code to execute'
    }],
    optional_args: []
};

/**
 * @param {Bot} bot Bot object that called
 * @param {Map} args Map of arguments
 * @param {Message} msg Message Object
 */
module.exports.main = async (bot, args, msg) => {
    try {
        const output = eval(args.get('code'));

        if (typeof output === 'object' && Promise.resolve(output) === output) {
            output.then((a) => msg.channel.send({
                embeds: [{
                    color: 7506394,
                    title: `Promise resolved`,
                    description: `Resolve: \`\`\`${util.inspect(a).slice(0, 1000)}\`\`\``
                }]
            }), (err) => msg.channel.send({
                embeds: [{
                    color: 11736341,
                    title: `Promise rejected`,
                    description: `Reject: \`\`\`${util.inspect(err).slice(0, 1000)}\`\`\``
                }]
            }));
        }

        msg.channel.send({
            embeds: [{
                color: 7506394,
                title: `Eval Result`,
                description: `Return: \`\`\`${util.inspect(output).slice(0, 1000)}\`\`\``
            }]
        });
    } catch (err) {
        msg.respond_error(`Failed to eval: ${err}`);
    }
}
