const Https = require('https');
const CommandUtils = require('../utils/command_utils');
const CommandError = require('../command_error');
const Logger = require('../logger');
const { pledge, check_permissions } = require('../utils/utils');
const MessageUtils = require('../utils/message_utils');

const INTERACTION_MAP = require('../../interaction_map.json');

function main(event) {
    if (event.t === 'INTERACTION_CREATE' && event.d?.data?.type === 1)
        handle_slash_command(this, event.d);
    else if (event.t === 'INTERACTION_CREATE' && (event.d?.data?.type === 2 || event.d?.data?.type === 3))
        handle_other_command(this, event.d, event.d);
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

async function handle_other_command(bot, data) {
    // Allow the interaction's main function to respond to the interaction
    data.respond = function (payload) { return interaction_respond(JSON.stringify(payload), this.id, this.token) };
    const cmd = bot.interactions[INTERACTION_MAP[data.data.id]];

    if (!cmd) {
        Logger.error(`Got interaction that is not loaded: id=${data.data.id} cmd=${cmd}`);
        return;
    }

    let err, guild, executor, target_member, target_msg, target_user;
    [err, guild] = await pledge(bot.client.guilds.fetch(data.guild_id));

    if (err) {
        Logger.error(err);
        return;
    }

    [err, executor] = await pledge(guild.members.fetch(data.member.user.id));

    if (err) {
        Logger.error(err);
        return;
    }

    if (!check_permissions(executor, cmd.required_permissions)) {
        data.respond({
            type: 4,
            data: {
                embeds: [{
                    title: `Command Error`,
                    fields: [{
                        name: 'Type',
                        value: 'Permission Error',
                        inline: false
                    }, {
                        name: 'Details',
                        value: `You must have ${cmd.required_permissions.join(' or ')} to execute this command`,
                        inline: false
                    }],
                    color: 0xFF6640,
                    timestamp: new Date().toISOString()
                }],
                flags: 1 << 6
            }
        });

        return;
    }

    // Fetch type-specific data and execute the interactions accordingly
    if (data.data.type === 2) {
        [err, target_member] = await pledge(guild.members.fetch(data.data.target_id));

        if (err) {
            [err, target_user] = await pledge(bot.client.users.fetch(data.data.target_id));
            target_member = {user: target_user};
        }

        [err] = await pledge(cmd.main(bot, executor, target_member, data));
    } else if (data.data.type === 3) {
        let context_channel;
        [err, context_channel] = await pledge(guild.channels.fetch(data.channel_id));

        if (err) {
            Logger.error(err);
            return;
        }

        [err, target_msg] = await pledge(context_channel.messages.fetch(data.data.target_id));

        if (err) {
            Logger.error(err);
            return;
        }

        [err] = await pledge(cmd.main(bot, executor, target_msg, data));
    }


    if (err instanceof CommandError) {
        data.respond({
            type: 4,
            data: {
                embeds: [{
                    title: `Command Error`,
                    fields: [{
                        name: 'Type',
                        value: err.type,
                        inline: false
                    }, {
                        name: 'Details',
                        value: err.msg,
                        inline: false
                    }],
                    color: 0xFF6640,
                    timestamp: new Date().toISOString()
                }],
                flags: 1 << 6
            }
        });
    } else if (err)
        Logger.error(err);
}

function interaction_respond(payload, id, token) {
    return new Promise((resolve, reject) => {
        // Escape all unicode characters
        payload = payload.split('').map((char) =>
            /[\u0080-\uFFFF]/g.test(char) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}` : char
        ).join('');

        Logger.info(`Responding to interaction id=${id}`);

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
                'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)'
            }
        };

        let response_data = '';
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
