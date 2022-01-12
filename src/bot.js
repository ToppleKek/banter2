const Discord = require('discord.js');
const SQLite3 = require('sqlite3').verbose();
const Logger = require('./logger');
const fs = require('fs');
const BanterGuild = require('./banter_guild');

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
        Discord.Message.prototype.respond_info = function(msg, header) {
            this.channel.send({embed: {
                color: 0x259EF5,
                title: header,
                description: msg,
            }});
        };

        Discord.Message.prototype.respond_command_error = function(type, msg) {
            const fields = [{
                name: 'Type',
                value: type,
                inline: false
            }, {
                name: 'Details',
                value: msg,
                inline: false
            }];

            if (msg.command) {
                fields.push({
                    name: 'Usage',
                    value: this.command.usage,
                    inline: false
                });
            }

            this.channel.send({embed: {
                author: {
                    name: `Command executed by ${this.author.username}#${this.author.discriminator}`,
                    iconURL: this.author.displayAvatarURL()
                },
                title: 'Command Error',
                fields,
                color: 0xFF6640,
                timestamp: Date.now()
            }});
        };

        Discord.Message.prototype.respond_error = function(msg) {
            this.channel.send({embed: {
                color: 0xFF6640,
                description: msg,
            }});
        };
        
        /** @type {Discord.Client} */
        this.client = new Discord.Client({ autoReconnect: true, disableEveryone: true });

        this.client.on('ready', async () => {
            Logger.info('bot is ready');

            Logger.info('setting up servers');

            this.client.guilds.cache.each((guild) => {
                Logger.info(`setting up: ${guild.name} - ${guild.id}`);
                this.guilds.set(guild.id, new BanterGuild(this, guild.id));
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

        this.client.login(this.token);
    }
}

module.exports = Bot;