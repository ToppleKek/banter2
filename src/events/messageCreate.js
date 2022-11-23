const { Message } = require("discord.js");
const Bot = require("../bot");
const CommandError = require("../command_error");
const CommandUtils = require("../utils/command_utils");
const Logger = require("../logger");
const { pledge, elide } = require("../utils/utils");

async function main(msg) {
    if (msg.author.bot || !msg.guild)
        return;

    try {
        await check_command(this, msg);
    } catch (err) {
        if (err instanceof CommandError)
            msg.respond_command_error(err.type, err.msg);
        else
            Logger.error(`command_handler: error: ${err}\n${err.stack}`);
    }

    const results = await Promise.allSettled([
        update_unique_authors(this, msg),
        check_spam(this, msg),
        run_binds(this, msg)
    ]);

    for (const result of results) {
        if (result.status === 'rejected')
            Logger.error(`Event messageCreate failed to run a task: ${result.reason}`);
    }
}

async function update_unique_authors(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);
    bguild.add_unique_author(msg.author.id);
}

async function check_spam(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);
    let in_row = bguild.config_get('asMInRow');
    let pings_in_row = bguild.config_get('asPing');

    if (in_row === 0 && pings_in_row == 0)
        return;

    let err, member, whitelisted_roles;
    [err, member] = await pledge(msg.guild.members.fetch(msg.author));

    if (!err && member) {
        [err, whitelisted_roles] = await pledge(bguild.get_whitelisted('antiSpam'));
        if (whitelisted_roles.some((whitelisted_role) => !!member.roles.resolve(whitelisted_role)))
            in_row = 0;

        [err, whitelisted_roles] = await pledge(bguild.get_whitelisted('antiPing'));
        if (whitelisted_roles.some((whitelisted_role) => !!member.roles.resolve(whitelisted_role)))
            pings_in_row = 0;
    }

    const cooldown_period = bguild.config_get('asCool');
    const ping_cooldown_period = bguild.config_get('asPCool');
    const spam_data = bguild.temp_storage().get('spam_data');

    if (!spam_data[msg.author.id]) {
        spam_data[msg.author.id] = {
            last_message_ts: Date.now(),
            last_message_content: msg.content,
            msg_count: 0,
            ping_msg_count: 0
        };
    }

    if (Date.now() - spam_data[msg.author.id].last_message_ts > cooldown_period * 1000) {
        spam_data[msg.author.id].last_message_content = msg.content;
        spam_data[msg.author.id].msg_count = 0;

        in_row = 0; // Disable anti-spam for the remainder of this function
    }

    const num_pings = [...msg?.content.matchAll(/<@[0-9]{17,19}>/g)].length;

    if (Date.now() - spam_data[msg.author.id].last_message_ts > ping_cooldown_period * 1000 && num_pings < pings_in_row) {
        spam_data[msg.author.id].ping_msg_count = 0;

        pings_in_row = 0; // Disable anti-ping-spam for the remainder of this function
    }

    spam_data[msg.author.id].last_message_ts = Date.now();

    // The user has posted the same message as last time we checked on them
    if (spam_data[msg.author.id].last_message_content === msg.content && in_row !== 0)
        ++spam_data[msg.author.id].msg_count;
    else {
        // Reset if this is a new message (or anti-spam is disabled ie. in_row is 0)
        spam_data[msg.author.id].last_message_content = msg.content;
        spam_data[msg.author.id].msg_count = 0;
    }

    // Add any member pings that were in the message to the total count
    spam_data[msg.author.id].ping_msg_count += num_pings ?? 0;

    const reset = () => {
        spam_data[msg.author.id] = {
            last_message_ts: Date.now(),
            last_message_content: msg.content,
            msg_count: 0,
            ping_msg_count: 0
        };
    };

    const should_punish = in_row !== 0 && spam_data[msg.author.id].msg_count >= in_row;
    const ping_should_punish = pings_in_row !== 0 && spam_data[msg.author.id].ping_msg_count >= pings_in_row;

    // Punish
    if (should_punish || ping_should_punish) {
        let err, member;
        [err, member] = await pledge(msg.guild.members.fetch(msg.author.id));

        if (err) {
            Logger.error(err);
            reset();
            return;
        }

        reset();

        const embed = {
            color: 0xBA211C,
            title: 'Anti-spam Message',
            description: `${ping_should_punish ? '(ping spam) ' : ''}Possible spam detected for user: \`${msg.author.tag}\`. *Please contact a moderator to be unmuted.*`
        };

        [err] = await pledge(member.timeout(2399999999, 'Possible spam detected, user has been muted'));

        if (err)
            return;

        bguild.mod_log(`indefinite mute`, bot.client.user, member.user, '**AUTOMATIC ACTION** Possible spam detected');
        await pledge(msg.channel.send({embeds: [embed]}));
    }
}

/**
 * Check a message for a command and execute it if found
 * @param {Bot} bot the bot
 * @param {Message} msg the message to check
 */
async function check_command(bot, msg) {
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

            const t = (await CommandUtils.get_token(bot, msg, buf)) || null;

            // TODO: I don't really know if I want to pass null users around. Is it better than passing around an invalid ID and
            // making the command do all the checking every time? idk
            // if (!t)
            //     throw new CommandError('ArgumentError', `Unexpected null token: invalid mention`);

            tokens.push(t);
        }
    }

    CommandUtils.execute_command(bot, msg, command, tokens);
}

async function run_binds(bot, msg) {
    const bguild = bot.guilds.get(msg.guild.id);
    const webhook_id = bguild.get_channel_bind(msg.channel.id);

    if (!webhook_id)
        return;

    let err, webhook;
    [err, webhook] = await pledge(bot.client.fetchWebhook(webhook_id));

    if (err) {
        Logger.error(err);
        return;
    }

    const attachments = msg.attachments.map((a) => a.url).join('\n');
    const content = `${elide(msg.content, 1999 - attachments.length) ?? ''}\n${attachments}`;

    [err, bot_msg] = await pledge(webhook.send({
        username: msg.author.username,
        avatarURL: msg.author.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' }),
        content,
        allowedMentions: {users:[]}
    }));

    if (err) {
        Logger.error(err);
        return;
    }

    bguild.channel_bind_messages.set(msg.id, {bot_msg_id: bot_msg.id, webhook_id});
};

module.exports.main = main;
