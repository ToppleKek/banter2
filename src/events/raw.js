const { Message } = require("discord.js");
const util = require('util');
const Https = require('https');
const CommandUtils = require('../utils/command_utils');
const CommandError = require("../command_error");
const Logger = require('../logger');
const { pledge } = require("../utils/utils");
const MessageUtils = require("../utils/message_utils");

function main(event) {
    if (event.t === 'INTERACTION_CREATE' && event.d.type === 2)
        handle_slash_command(this, event.d);
}

function subscribe(guild, macro) {
    // subscribed_macros.push({
    //     guild,
    //     payload: macro
    // });
}

async function handle_slash_command(bot, data) {
    const cmd_payload = {
        type: 4,
        data: {
            embeds: [{
                description: `**${data.member.user.username}**: Your interaction was successfully handed off to the main bot.`,
                color: 0x03fca1
            }]
        }
    };

    const payload = JSON.stringify(cmd_payload);
    let [err, response] = await pledge(interaction_respond(payload, data.id, data.token));

    if (err) {
        Logger.error(`Failed to respond to interaction: ${err}`);
        return;
    }

    const cmd = data.data.name;
    const tokens = [];

    let guild, channel, author, member;
    [err, guild] = await pledge(bot.client.guilds.fetch(data.guild_id));

    if (err) {
        Logger.error(err);
        return;
    }

    [err, channel] = await pledge(bot.client.channels.fetch(data.channel_id));

    if (err) {
        Logger.error(err);
        return;
    }

    [err, author] = await pledge(bot.client.users.fetch(data.member.user.id));

    if (err) {
        Logger.error(err);
        return;
    }

    [err, member] = await pledge(guild.members.fetch(author.id));

    if (err) {
        Logger.error(err);
        return;
    }

    // Fake message for compatibility
    const msg = {
        guild,
        channel,
        author,
        member
    };

    msg.respond_info = MessageUtils.respond_info.bind(msg);
    msg.respond_command_error = MessageUtils.respond_command_error.bind(msg);
    msg.respond_error = MessageUtils.respond_error.bind(msg);

    if (data.data.options) {
        for (let option of data.data.options)
            tokens.push(await CommandUtils.get_token(bot, msg, option.value));
    }

    try {
        CommandUtils.execute_command(bot, msg, bot.commands[cmd], tokens);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
        else
            Logger.error(`handle_slash_command: error: ${err}\n${err.stack}`);
    }

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
        const request = Https.request(`https://discord.com/api/v10/interactions/${id}/${token}/callback`, options, (response) => {
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
