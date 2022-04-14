const Logger = require('./logger');
const SCHEMA = require('../config_schema.json');
const Ajv = require('ajv');
const Validate = new Ajv({ allErrors: true }).compile(SCHEMA);
const CONFIG = require('../config.json');

class BanterGuild {
    constructor(bot, id) {
        this.dguild = bot.client.guilds.cache.get(id);
        this.id = id;
        this.bot = bot;
        this.db = bot.db;
        this._temp_storage = new Map();
        this._config = {};
        this._invites = new Map();

        this.dguild.invites.fetch().then((guild_invites) => {
            guild_invites.each(async (invite) => {
                invite = await bot.client.fetchInvite(invite).catch((err) =>  {
                    Logger.error(`Stupid djs error from invite=${invite} err=${err}`);
                });

                if (invite) {
                    this._invites.set(invite.code, {
                        code: invite.code,
                        inviter: invite.inviter,
                        uses: invite.memberCount,
                    });
                }
            });
        }).catch((err) => {
            Logger.warn(`Failed to fetch invites for guild: ${this.id}: ${err}`);
        });
    }

    db_get(field) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT ${field} FROM servers WHERE id = ?`, this.id, (err, row) => {
                if (err)
                    reject(err);
                else if (!row || row[field] === undefined)
                    reject('null row or undefined field');
                else
                    resolve(row[field]);
            });
        });
    }

    db_set(field, value) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE servers SET ${field} = ? WHERE id = ?`, value, this.id, (err) => {
                if (err)
                    reject(err);
                else
                    resolve(true);
            });
        });
    }

    db_reset() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('DELETE FROM servers WHERE id = ?', this.id, (err) => {
                    if (err)
                        reject(err);
                });

                this.db.run('INSERT INTO servers (id) VALUES (?)', this.id, (err) => {
                    if (err)
                        reject(err);

                    resolve(true);
                });
            });
        });
    }

    async _reload_config() {
        const b64_config = await this.db_get('config').catch((err) => {}); // TODO: this can be changed back to a log once we insert new db rows for all servers
        const load_default_config = function() {
            const json = Buffer.from(CONFIG.default_config, 'base64').toString('binary');
            return JSON.parse(json);
        }

        if (!b64_config)
            this._config = load_default_config();
        else {
            const json = Buffer.from(b64_config, 'base64').toString('binary');
            const config = JSON.parse(json);

            if (!Validate(config)) {
                Logger.warn(`reload_config: config for server ${this.id} is invalid- defaults loaded`);
                this._config = load_default_config();
            } else
                this._config = config;
        }
    }

    async _load_new_config(b64_config) {
        const json = Buffer.from(b64_config, 'base64').toString('binary');
        const config = JSON.parse(json);

        if (!Validate(config))
            throw new Error('Invalid config');

        this._config = config;
        return this.db_set('config', b64_config);
    }

    config_get(key) {
        if (this._config[key] === undefined)
            throw new Error(`Invalid key: ${key}`);

        return this._config[key];
    }

    temp_storage() {
        return this._temp_storage;
    }

    invites() {
        return this._invites;
    }

    async log(embed_options) {
        const log_id = await this.db_get('log');
        const log_channel = await this.bot.client.channels.fetch(log_id).catch(Logger.warn); // TODO: messages system (when implemented) should report this error to the server mods

        if (!log_channel)
            return;

        const embed = { // TODO: what else is generic in logs?
            timestamp: Date.now(),
        };

        Object.assign(embed, embed_options);
        await log_channel.send({embed});
    }

    async mod_log(action, mod, target, reason) {
        const mod_log_id = await this.db_get('log');
        const mod_log_channel = await this.bot.client.channels.fetch(mod_log_id).catch(Logger.warn); // TODO: messages system (when implemented) should report this error to the server mods

        if (!mod_log_channel)
            return;

        const embed = {
            author: {
                name: 'Moderator action taken',
                iconURL: mod.avatarURL({ size: 2048, dynamic: true, format: 'png' }),
            },
            description: reason || 'N/A',
            fields: [{
                name: 'Action',
                value: action,
            }, {
                name: 'Responsable Moderator',
                value: mod.tag,
            }, {
                name: 'Target',
                value: (typeof target) === 'string' ? target : target.tag,
            }],
            timstamp: Date.now(),
            color: 0x0084ff,
        };

        await mod_log_channel.send({embed});
    }

    async get_auto_roles() {
        const db_response = await this.db_get('autoroles').catch(Logger.error);
        return db_response ? db_response.split(',') : [];
    }

    async remove_auto_role(role) {
        const autoroles = await this.get_auto_roles();
        const i = autoroles.indexOf(role);

        if (i > -1) {
            autoroles.splice(i, 1);
            return this.db_set('autoroles', autoroles.join(','));
        } else
            return false;

    }

    async add_auto_role(role) {
        const autoroles = await this.get_auto_roles();
        const i = autoroles.indexOf(role);

        if (i < 0) {
            autoroles.push(role);
            return this.db_set('autoroles', autoroles.join(','));
        } else
            return false;
    }
}

module.exports = BanterGuild;
