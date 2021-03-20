const { Message } = require("discord.js");
const util = require('util');
const Https = require('https');
const CommandUtils = require('../utils/command_utils');

function main(event) {
    if (event.t === 'INTERACTION_CREATE')
        handle_slash_command(this, event.d);

}

function handle_slash_command(bot, data) {
    const cmd_payload = {
        type: 4,
        data: {
            embeds: [{
                description: `Handing off this interaction to the main bot... (command_id=${data.data.id} command=${data.data.name})`,
                color: 0xAA00FF
            }],
            flags: 64
        }
    };

    const payload = JSON.stringify(cmd_payload);
    interaction_respond(payload, data.id, data.token)
        .then((response) => {
            const cmd = data.data.name;
            const tokens = [];
        
            for (let option in data.options)
                tokens.push(CommandUtils.get_token(option.value));
        
            // find message
            const channel = bot.client.channels.cache.get(data.channel_id);
            const msgs = channel.messages.cache.first(20).filter(msg => msg.content.startsWith(`</${data.data.name}:${data.data.id}>`) && msg.author.id === data.member.user.id);
            msgs.sort((msg1, msg2) => msg2.createdTimestamp - msg1.createdTimestamp);
        
            CommandUtils.execute_command(bot, msgs[0], bot.commands[cmd], tokens);
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