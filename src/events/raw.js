const { Message } = require("discord.js");
const util = require('util');
const Https = require('https');
const CommandUtils = require('../utils/command_utils');
const CommandError = require("../command_error");

function main(event) {
    if (event.t === 'INTERACTION_CREATE')
        handle_slash_command(this, event.d);

}

function handle_slash_command(bot, data) {
    const cmd_payload = {
        type: 5
    };

    const payload = JSON.stringify(cmd_payload);
    interaction_respond(payload, data.id, data.token)
        .then((response) => {
            const cmd = data.data.name;
            const tokens = [];

            if (data.data.options) {
                for (let option of data.data.options)
                    tokens.push(CommandUtils.get_token(bot, option.value));
            }

            // find message
            const channel = bot.client.channels.cache.get(data.channel_id);
            const msgs = channel.messages.cache.first(20).filter(msg => msg.content.startsWith(`</${data.data.name}:${data.data.id}>`) && msg.author.id === data.member.user.id);
            msgs.sort((msg1, msg2) => msg2.createdTimestamp - msg1.createdTimestamp);

            try {
                CommandUtils.execute_command(bot, msgs[0], bot.commands[cmd], tokens);
            } catch (err) {
                if (err instanceof CommandError)
                    msgs[0].respond_command_error(err.type, err.msg);
                else
                    bot.logger.error(`handle_slash_command: error: ${err}`);
            }
            
        })
        .catch((err) => {
            bot.logger.error(`Failed to respond to interaction: ${err}`);
        });
}

function interaction_respond(payload, id, token) {
    return new Promise((resolve, reject) => {
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": payload.length,
                "User-Agent": "DiscordBot (https://github.com/ToppleKek/banter2)"
            }
        };
    
        let response_data = "";
        const request = Https.request(`https://discord.com/api/v8/interactions/${id}/${token}/callback`, options, (response) => {
            response.on('data', (chunk) => {
                response_data += chunk;
            });
    
            response.on('end', () => {
                resolve(response_data);
            });

            response.on('error', (err) => {
                reject(err);
            });
        });
    
        request.write(payload);
        request.end();
    });
}

module.exports.main = main;