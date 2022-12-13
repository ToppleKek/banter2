const Https = require('https');
const { Message } = require("discord.js");
const CommandUtils = require('../utils/command_utils');
const CommandError = require('../command_error');
const Logger = require('../logger');
const { pledge, check_permissions, command_error_if } = require('../utils/utils');
const MessageUtils = require('../utils/message_utils');
const INTERACTION_MAP = require('../../interaction_map.json');
const { Interaction } = require('../interactions');

async function main(event) {
    try {
        if (event.t === 'INTERACTION_CREATE' && event.d?.data?.type === 1)
            await handle_slash_command(this, event.d);
        else if (event.t === 'INTERACTION_CREATE' && (event.d?.data?.type === 2 || event.d?.data?.type === 3))
            await handle_other_command(this, event.d, event.d);
        else if (event.t === 'INTERACTION_CREATE' && event.d?.type === 5) {
            const data = {
                interaction: new Interaction(this, event.d.id, event.d.token),
                data: event.d.data
            };

            this.client.emit('banter_modalInteraction', data);
        }
    } catch (err) {
        Logger.error(`Failed to handle interaction: ${err}`);
    }
}

async function deny_request(interaction) {
    const cmd_payload = {
        type: 4,
        data: {
            embeds: [{
                description: `Interactions are disabled on your server. Bot rewrite testing is in progress, they should be available soon.`,
                color: 0x03fca1
            }]
        }
    };

    await pledge(interaction.respond(cmd_payload));
}

async function handle_slash_command(bot, data) {
    const interaction = new Interaction(bot, data.id, data.token);

    if (!data.member) {
        const cmd_payload = {
            type: 4,
            data: {
                embeds: [{
                    description: `Slash commands are not supported in DM channels`,
                    color: 0xff6640
                }]
            }
        };

        await pledge(interaction.respond(cmd_payload));
        return;
    }

    if (!bot.enabled_guilds.includes(data.guild_id) && bot.enabled_guilds.length > 0) {
        await deny_request(interaction);
        return;
    }

    const cmd = data.data.name;
    let guild, channel, author, member;

    [err, [guild, channel]] = await pledge([bot.client.guilds.fetch(data.guild_id), bot.client.channels.fetch(data.channel_id)]);
    if (err.length) {
        Logger.error(err.toString());
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

    if (!check_permissions(member, bot.commands[cmd].required_permissions)) {
        const payload = {
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
                        value: `You must have ${bot.commands[cmd].required_permissions.join(' or ')} to execute this command`,
                        inline: false
                    }],
                    color: 0xFF6640,
                    timestamp: new Date().toISOString()
                }],
            }
        };

        const [err, response] = await pledge(interaction.respond(payload));

        if (err)
            Logger.error(`Failed to respond to permission error: ${err} ${response}`);

        return;
    }

    // Fake message for compatibility
    const msg = {
        guild,
        channel,
        author,
        member
    };

    const args = new Map();

    // Fetch any args that were passed to us by the interaction (the slash command 'options')
    // TODO: Skip ID type detection because we should already know that from the option data
    if (data.data.options) {
        for (let option of data.data.options) {
            const token = await CommandUtils.get_token(bot, msg, option.value);
            args.set(option.name, token.value);
        }
    }

    // Callback to override the 'msg.respond' function for messages. This callback responds to the interaction,
    // and then resets the function to its original found in MessageUtils (just sends the message).
    const cmd_respond = async (msg_data) => {
        // d.js hack
        if (msg_data.embeds) {
            for (let embed of msg_data.embeds) {
                if (embed.author)
                embed.author.icon_url = embed.author.iconURL;
            }
        }

        // Setup payload to respond to the interaction with the message data passed from the command
        if ((typeof msg_data) === 'string') {
            msg_data = {
                content: msg_data
            };
        }

        const response_payload = {
            type: 4,
            data: msg_data
        };

        // Respond to the interaction
        let err, interaction_message;
        [err] = await pledge(interaction.respond(response_payload));

        if (err) {
            Logger.error(err);
            return;
        }

        // Get the message we just sent so we can return it here
        // (some commands like 'whipall' use the message return to setup a interaction collector for instance)
        [err, interaction_message] = await pledge(interaction_get_msg(bot.appid, data.token));

        if (err) {
            Logger.error(err);
            return;
        }

        interaction_message = new Message(bot.client, JSON.parse(interaction_message));
        // Reset respond handler
        msg.respond = MessageUtils.respond.bind(msg);
        return interaction_message;
    };

    // Setup response handlers for this fake message
    msg.respond_info = MessageUtils.respond_info.bind(msg);
    msg.respond_command_error = MessageUtils.respond_command_error.bind(msg);
    msg.respond_error = MessageUtils.respond_error.bind(msg);
    msg.respond = cmd_respond;

    // Execute the command
    try {
        await bot.commands[cmd].main(bot, args, msg);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
        else
            Logger.error(`handle_slash_command: error: ${err}\n${err.stack}`);
    }
}

async function handle_other_command(bot, data) {
    const interaction = new Interaction(bot, data.id, data.token);
    if (!bot.enabled_guilds.includes(data.guild_id) && bot.enabled_guilds.length > 0) {
        await deny_request(interaction);
        return;
    }

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
        [err] = await pledge(interaction.respond({
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
        }));

        if (err)
            Logger.error(err);

        return;
    }

    // Fetch type-specific data and execute the interactions accordingly
    if (data.data.type === 2) {
        [err, target_member] = await pledge(guild.members.fetch(data.data.target_id));

        if (err) {
            [err, target_user] = await pledge(bot.client.users.fetch(data.data.target_id));
            target_member = {user: target_user};
        }

        [err] = await pledge(cmd.main(bot, executor, target_member, interaction));
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

        [err] = await pledge(cmd.main(bot, executor, target_msg, interaction));
    }


    if (err instanceof CommandError) {
        interaction.respond({
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

function interaction_get_msg(appid, token) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'DiscordBot (https://github.com/ToppleKek/banter2)'
            }
        };

        let response_data = '';
        const request = Https.request(`https://discord.com/api/v10/webhooks/${appid}/${token}/messages/@original`, options, (response) => {
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

        request.end();
    });
}

module.exports.main = main;
