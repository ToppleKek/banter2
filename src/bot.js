const Discord = require('discord.js');
const SQLite3 = require('sqlite3').verbose();
const Logger = require('./logger');
const fs = require('fs');
const BanterGuild = require('./banter_guild');
const ActionLogger = require('./action_logger');
const MessageUtils = require('./utils/message_utils');
const { pledge } = require('./utils/utils');

/**
 * @type {Bot}
 * @type {Discord.Message}
 */
class Bot {
    constructor(config) {
        this.token           = config.token;
        this.prefix          = config.prefix;
        this.owner_id        = config.owner_id;
        this.appid           = config.appid;
        this.error_channel   = config.error_channel;
        this.enabled_guilds  = config.enabled_guilds;
        this.commands        = {};
        this.events          = {};
        this.interactions    = {};
        this.guilds          = new Map();
        this.stat_timer      = null;
        this.temp_ban_timers = new Map();

        this.db = new SQLite3.Database(config.db_file, (err) => {
            if (err) {
                Logger.error(`Failed to connect to database! ${err}`);
                process.exit(1);
            } else {
                Logger.info('Connected to database');
            }
        });

        SQLite3.Database.prototype.getp = function(sql, ...params) {
            return new Promise((resolve, reject) => {
                this.get(sql, ...params, (err, row) => {
                    if (err)
                        reject(err);

                    resolve(row);
                });
            });
        };

        SQLite3.Database.prototype.allp = function(sql, ...params) {
            return new Promise((resolve, reject) => {
                this.all(sql, ...params, (err, rows) => {
                    if (err)
                        reject(err);

                    resolve(rows);
                });
            });
        };

        SQLite3.Database.prototype.runp = function(sql, ...params) {
            return new Promise((resolve, reject) => {
                this.run(sql, ...params, (err) => {
                    if (err)
                        reject(err);

                    resolve();
                });
            });
        };
    }

    db_get_global(field) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT ${field} FROM global_data`, (err, row) => {
                if (err)
                    reject(new Error(err));
                else if (!row || row[field] === undefined)
                    reject(new Error('null row or undefined field'));
                else
                    resolve(row[field]);
            });
        });
    }

    db_set_global(field, value) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE global_data SET ${field} = ?`, value, (err) => {
                if (err)
                    reject(new Error(err));
                else
                    resolve();
            });
        });
    }

    async start() {
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
                b_guild.temp_storage().set('spam_data', {});
                this.guilds.set(guild.id, b_guild);
            });

            Logger.info('done setting up servers');
            Logger.info('Temp ban timer init...');

            const temp_bans = await this.db.allp('SELECT * FROM temp_bans');
            for (const temp_ban of temp_bans) {
                const bguild = this.guilds.get(temp_ban.guild_id);

                // Remove any stale temp bans at startup
                if (temp_ban.start_timestamp + temp_ban.duration <= Date.now()) {
                    Logger.info(`Removing stale temp ban on guild ${temp_ban.guild_id} for user ${temp_ban.user_id}`);
                    bguild.remove_temp_ban(temp_ban.user_id);
                }

                const existing_ban = await bguild.dguild.bans.fetch(temp_ban.user_id).catch(() => {});

                // User was manually unbanned
                if (!existing_ban) {
                    Logger.info(`Removing obsolete temp ban on guild ${temp_ban.guild_id} for user ${temp_ban.user_id}`);
                    bguild.remove_temp_ban(temp_ban.user_id);
                }

                this.temp_ban_timers.set(
                    `${temp_ban.guild_id}:${temp_ban.user_id}`,
                    setTimeout(() => bguild.remove_temp_ban(temp_ban.user_id), temp_ban.duration - (Date.now() - temp_ban.start_timestamp))
                );
            }
        });

        Logger.info('Loading commands...');
        Logger.debug(__dirname);
        const command_files = fs.readdirSync(`${__dirname}/commands`);

        for (const file of command_files) {
            if (file.endsWith('.js')) {
                this.commands[file.slice(0, -3)] = require(`${__dirname}/commands/${file}`);
                Logger.info(`Loaded command file: ${file}`);
            }
        }

        Logger.info('All commands loaded');
        Logger.info('Loading events...');
        const event_files = fs.readdirSync(`${__dirname}/events`);

        for (const file of event_files) {
            if (file.endsWith('.js')) {
                const event = file.slice(0, -3);
                this.events[event] = require(`${__dirname}/events/${file}`);
                this.client.on(event, this.events[event].main.bind(this));
                Logger.info(`Loaded event file: ${file}`);
            }
        }

        Logger.info('All events loaded');
        Logger.info('Loading interactions...');
        const interaction_files = fs.readdirSync(`${__dirname}/interactions`);

        for (const file of interaction_files) {
            if (file.endsWith('.js')) {
                const interaction = file.slice(0, -3);
                this.interactions[interaction] = require(`${__dirname}/interactions/${file}`);
                Logger.info(`Loaded interaction file: ${file}`);
            }
        }

        // Setup custom guildMemberAdd for invite counting
        // This event will add a property to get what invite the user joined with
        this.client.on('guildMemberAdd', async (member) => {
            const bguild = this.guilds.get(member.guild.id);
            const [err, guild_invites] = await pledge(member.guild.invites.fetch());

            if (err) {
                Logger.error(err);
                return;
            }

            for (const [code, invite] of guild_invites.entries()) {
                // Check if the number of uses for this invite changed.
                // If it did that probably means that this was the invite that was used.
                let binv = bguild.invites().get(code);

                if (!binv) {
                    Logger.error(`FIXME: Undefined binv: code=${code} invite=${invite} guild_id=${member.guild.id}`);
                    return;
                }

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

        this.stat_timer = setInterval(() => {
            this.client.emit('statisticUpdate');
        }, 5 * 60 * 1000);

        Logger.info('ActionLogger init...');

        for (const event in ActionLogger)
            this.client.on(event, (...args) => ActionLogger[event](this, ...args));

        this.client.login(this.token);
    }
}

module.exports = Bot;
