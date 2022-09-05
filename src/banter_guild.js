const Logger = require('./logger');
const SCHEMA = require('../config_schema.json');
const Ajv = require('ajv');
const Validate = new Ajv({ allErrors: true }).compile(SCHEMA);
const CONFIG = require('../config.json');
const { pledge } = require('./utils/utils');

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
            for (const [code, invite] of guild_invites.entries()) {
                if (invite) {
                    this._invites.set(invite.code, {
                        code: invite.code,
                        inviter: invite.inviter,
                        uses: invite.uses,
                    });
                }
            }
        }).catch((err) => {
            Logger.warn(`Failed to fetch invites for guild: ${this.id}: ${err}`);
        });
    }

    db_get(field) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT ${field} FROM servers WHERE id = ?`, this.id, (err, row) => {
                if (err)
                    reject(new Error(err));
                else if (!row || row[field] === undefined)
                    reject(new Error('null row or undefined field'));
                else
                    resolve(row[field]);
            });
        });
    }

    db_set(field, value) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE servers SET ${field} = ? WHERE id = ?`, value, this.id, (err) => {
                if (err)
                    reject(new Error(err));
                else
                    resolve();
            });
        });
    }

    db_reset() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('DELETE FROM servers WHERE id = ?', this.id, (err) => {
                    if (err)
                        reject(new Error(err));
                });

                this.db.run('INSERT INTO servers (id) VALUES (?)', this.id, (err) => {
                    if (err)
                        reject(new Error(err));

                    resolve();
                });
            });
        });
    }

    async _reload_config() {
        const [err, b64_config] = await pledge(this.db_get('config'));

        if (err) {
            // TODO: this can be changed back to a log once we insert new db rows for all servers
            // Logger.error(err);
            return;
        }

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
        const [err, log_id] = await pledge(this.db_get('log'));

        if (err) {
            // TODO: this can be changed back to a log once we insert new db rows for all servers
            return;
        }

        const log_channel = await this.bot.client.channels.fetch(log_id).catch(Logger.warn); // TODO: messages system (when implemented) should report this error to the server mods

        if (!log_channel)
            return;

        const embed = { // TODO: what else is generic in logs?
            timestamp: new Date().toISOString(),
        };

        Object.assign(embed, embed_options);
        await log_channel.send({embeds: [embed]});
    }

    async mod_log(action, mod, target, reason) {
        const [err, mod_log_id] = await pledge(this.db_get('modlog'));

        if (err) {
            // TODO: this can be changed back to a log once we insert new db rows for all servers
            return;
        }

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

        await mod_log_channel.send({embeds: [embed]});
    }

    async _get_array_backed_db_storage(key) {
        let [err, db_response] = await pledge(this.db_get(key));

        if (!db_response)
            db_response = '[]';

        return err ? [] : JSON.parse(db_response);
    }

    async _add_array_backed_db_storage(key, value, finder) {
        const values = await this._get_array_backed_db_storage(key);

        if (values.find(finder ?? ((v) => v === value)))
            return false;

        values.push(value);
        await this.db_set(key, JSON.stringify(values));
        return true;
    }

    async _remove_array_backed_db_storage(key, value, finder) {
        const values = await this._get_array_backed_db_storage(key);
        const i = values.findIndex(finder ?? ((v) => v === value));

        if (i < 0)
            return false;

        values.splice(i, 1);
        await this.db_set(key, JSON.stringify(values));
        return true;
    }

    async get_auto_roles() {
        return this._get_array_backed_db_storage('autoroles');
    }

    async remove_auto_role(role) {
        return this._remove_array_backed_db_storage('autoroles', role);
    }

    async add_auto_role(role) {
        return this._add_array_backed_db_storage('autoroles', role);
    }

    async get_pub_roles() {
        return this._get_array_backed_db_storage('pubroles');
    }

    async toggle_pub_role(role) {
        const pubroles = await this.get_pub_roles();
        const i = pubroles.findIndex((r) => r === role);

        if (i < 0)
            pubroles.push(role);
        else
            pubroles.splice(i, 1);

        await this.db_set('pubroles', JSON.stringify(pubroles));
        return i < 0;
    }

    async get_tags() {
        return this._get_array_backed_db_storage('tags');
    }

    async add_tag(key, content) {
        return this._add_array_backed_db_storage('tags', {key, content}, (tag) => tag.key === key);
    }

    async remove_tag(key) {
        return this._remove_array_backed_db_storage('tags', key, (tag) => tag.key === key);
    }
}

module.exports = BanterGuild;
