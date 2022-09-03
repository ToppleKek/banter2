const Discord = require('discord.js');
const SQLite3 = require('sqlite3').verbose();
const Logger = require('./logger');
const fs = require('fs');
const BanterGuild = require('./banter_guild');
const ActionLogger = require('./action_logger');
const MessageUtils = require('./utils/message_utils');

/**
 * @type {Bot}
 * @type {Discord.Message}
 */
class Bot {
    constructor(config) {
        this.token         = config.token;
        this.prefix        = config.prefix;
        this.owner_id      = config.owner_id;
        this.appid         = config.appid;
        this.error_channel = config.error_channel;
        this.commands      = {};
        this.events        = {};
        this.guilds        = new Map();

        this.db = new SQLite3.Database(config.db_file, (err) => {
            if (err) {
                Logger.error(`Failed to connect to database! ${err}`);
                process.exit(1);
            } else {
                Logger.info('Connected to database');
            }
        });
    }

    start() {
        Discord.Message.prototype.respond_info = MessageUtils.respond_info;
        Discord.Message.prototype.respond_command_error = MessageUtils.respond_command_error;
        Discord.Message.prototype.respond_error = MessageUtils.respond_error;

        /** @type {Discord.Client} */
        this.client = new Discord.Client({ autoReconnect: true, disableEveryone: true, intents: 0b11111111111111111 });

        this.client.on('ready', async () => {
            Logger.info('bot is ready');

            Logger.info('setting up servers');

            this.client.guilds.cache.each(async (guild) => {
                Logger.info(`setting up: ${guild.name} - ${guild.id}`);
                const b_guild = new BanterGuild(this, guild.id);

                await b_guild._reload_config();
                this.guilds.set(guild.id, b_guild);
            });

            Logger.info('done setting up servers');
        });

        Logger.info('Loading commands...');
        Logger.debug(__dirname);
        const command_files = fs.readdirSync(`${__dirname}/commands`);

        for (let file of command_files) {
            if (file.endsWith('.js')) {
                this.commands[file.slice(0, -3)] = require(`${__dirname}/commands/${file}`);
                Logger.info(`Loaded command file: ${file}`);
            }
        }

        Logger.info('All commands loaded');
        Logger.info('Loading events...');
        const event_files = fs.readdirSync(`${__dirname}/events`);

        for (let file of event_files) {
            if (file.endsWith('.js')) {
                const event = file.slice(0, -3);
                this.events[event] = require(`${__dirname}/events/${file}`);
                this.client.on(event, this.events[event].main.bind(this));
                Logger.info(`Loaded event file: ${file}`);
            }
        }

        Logger.info('All events loaded');

        // Setup custom guildMemberAdd for invite counting
        // This event will add a property to get what invite the user joined with
        this.client.on('guildMemberAdd', async (member) => {
            const bguild = this.guilds.get(member.guild.id);
            const guild_invites = await member.guild.invites.fetch();

            for (const [code, invite] of guild_invites.entries()) {
                // Check if the number of uses for this invite changed.
                // If it did that probably means that this was the invite that was used.
                let binv = bguild.invites().get(code);
                let current_uses = binv.uses;
                binv.uses = invite.uses;

                Logger.debug(`current_uses=${current_uses} binv.uses=${binv.uses} invite.uses=${invite.uses} code=${code}`);
                if (current_uses !== invite.uses) {
                    // Update the invite store
                    bguild.invites().set(code, Object.assign(binv, {uses: invite.uses}));
                    Logger.debug(`Invite store: invite now: ${bguild.invites().get(code)}`);
                    member.invite_code = code;
                    member.inviter = binv.inviter;
                    break;
                }
            }

            // Emit our custom event
            this.client.emit('banter_guildMemberAdd', member);
        });
        Logger.info('ActionLogger init...');

        for (const event in ActionLogger)
            this.client.on(event, (...args) => ActionLogger[event](this, ...args));

        this.client.login(this.token);
    }
}

module.exports = Bot;
