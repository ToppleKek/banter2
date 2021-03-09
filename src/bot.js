const Discord = require('discord.js');
const SQLite3 = require('sqlite3').verbose();
const Logger = require('./logger');
const fs = require('fs');

/**
 * @type {Bot}
 * @type {Discord.Message}
 */
class Bot {
    constructor(config) {
        this.token         = config.token;
        this.prefix        = config.prefix;
        this.owner_id      = config.owner_id;
        this.error_channel = config.error_channel;
        this.commands      = {};
        this.events        = {};
        this.logger        = new Logger(`./logs/${Date.now()}_LOG.txt`);

        this.db = new SQLite3.Database(config.db_file, (err) => {
            if (err) {
                this.logger.error(`Failed to connect to database! ${err}`);
                process.exit(1);
            } else {
                this.logger.info('Connected to database');
            }
        });
    }

    start() {
        /** @type {Discord.Client} */
        this.client = new Discord.Client({ autoReconnect: true, disableEveryone: true });

        this.client.on('ready', async () => {
            this.logger.info('bot is ready');
        });

        this.logger.info('Loading commands...');
        this.logger.debug(__dirname);
        const command_files = fs.readdirSync(`${__dirname}/commands`);

        for (let file of command_files) {
            if (file.endsWith('.js')) {
                this.commands[file.slice(0, -3)] = require(`${__dirname}/commands/${file}`);
                this.logger.info(`Loaded command file: ${file}`);
            }
        }

        this.logger.info('All commands loaded');
        this.logger.info('Loading events...');
        const event_files = fs.readdirSync(`${__dirname}/events`);

        for (let file of event_files) {
            if (file.endsWith('.js')) {
                const event = file.slice(0, -3);
                this.events[event] = require(`${__dirname}/events/${file}`);
                this.client.on(event, this.events[event].main.bind(this));
                this.logger.info(`Loaded event file: ${file}`);
            }
        }

        this.client.login(this.token);
    }
}

module.exports = Bot;