const Logger = require('./logger');
const SCHEMA = require('../config_schema.json');
const Ajv = require('ajv');
const Validate = new Ajv({ allErrors: true }).compile(SCHEMA);
const CONFIG = require('../config.json');
const { pledge } = require('./utils/utils');

const DEFAULT_CONFIG = JSON.parse(Buffer.from(CONFIG.default_config, 'base64').toString('binary'));

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

    async fetch_dguild() {
        this.dguild = await this.bot.client.guilds.fetch(this.id);
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

        if (!b64_config)
            this._config = DEFAULT_CONFIG;
        else {
            const json = Buffer.from(b64_config, 'base64').toString('binary');
            const config = JSON.parse(json);

            if (!Validate(config)) {
                Logger.warn(`reload_config: config for server ${this.id} is invalid- defaults loaded`);
                this._config = DEFAULT_CONFIG;
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
        if (this._config[key] === undefined && DEFAULT_CONFIG[key] === undefined)
            throw new Error(`Invalid key: ${key}`);

        return this._config[key] ?? DEFAULT_CONFIG[key];
    }

    temp_storage() {
        return this._temp_storage;
    }

    invites() {
        return this._invites;
    }

    async log(embed_options, relog_id = null) {
        const [err, log_id] = await pledge(this.db_get('log'));

        if (err || !log_id) {
            // TODO: this can be changed back to a log once we insert new db rows for all servers
            return;
        }

        const log_channel = await this.bot.client.channels.fetch(log_id).catch(Logger.warn); // TODO: messages system (when implemented) should report this error to the server mods

        if (!log_channel)
            return;

        if (relog_id) {
            const [err, audit] = await pledge(this.dguild.fetchAuditLogs({ type: 72 })); // Type 72 = MessageDelete

            if (err) {
                Logger.error(err);
                return;
            }

            const entry = audit.entries.find((a) => a.target.id === relog_id);

            await log_channel.send({embeds: [{
                title: `${entry?.executor?.tag ?? 'Someone'} tried to delete a log entry!`,
                description: `Attempting to resend entry in next message`,
                color: 0xFFAA00
            }]});

            await log_channel.send({embeds: [embed_options]});
            return;
        }

        const embed = { // TODO: what else is generic in logs?
            timestamp: new Date().toISOString(),
        };

        Object.assign(embed, embed_options);
        await log_channel.send({embeds: [embed]});
    }

    async mod_log(action, mod, target, reason) {
        const [err, mod_log_id] = await pledge(this.db_get('modlog'));

        if (err || !mod_log_id) {
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
                inline: true
            }, {
                name: 'Responsable Moderator',
                value: mod.tag,
                inline: true
            }, {
                name: 'Target',
                value: (typeof target) === 'string' ? target : target.tag,
                inline: true
            }],
            timestamp: new Date().toISOString(),
            color: 0x0084ff,
        };

        await mod_log_channel.send({embeds: [embed]});
    }

    async temp_ban(user, author, duration, days, reason = 'No reason provided') {
        let member;

        if ((member = (await this.dguild.members.fetch(user).catch(() => {}))) && !member.bannable)
            throw new Error(`Member ${member.user.tag} is not bannable`);

        const existing_ban = await this.bot.db.getp(
            'SELECT * FROM temp_bans WHERE guild_id = ? AND user_id = ?',
            this.id,
            user.id
        );

        if (existing_ban)
            throw new Error(`Member ${user.tag} is already temp banned`);

        this.dguild.bans.create(user, { deleteMessageDays: days, reason });

        this.bot.db.runp(
            'INSERT INTO temp_bans (guild_id, user_id, author_id, duration, start_timestamp) VALUES (?, ?, ?, ?, ?)',
            this.id,
            user.id,
            author.id,
            duration,
            Date.now()
        );

        this.bot.temp_ban_timers.set(`${this.id}:${user.id}`, setTimeout(() => this.remove_temp_ban(user.id), duration));
    }

    async remove_temp_ban(user_id, api = true) {
        const timer = this.bot.temp_ban_timers.get(`${this.id}:${user_id}`);

        if (timer)
            clearTimeout(timer);

        if (api)
            await pledge(this.dguild.bans.remove(user_id, 'Remove temp ban'));

        this.bot.db.runp('DELETE FROM temp_bans WHERE guild_id = ? AND user_id = ?', this.id, user_id);
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

    async get_stat_channels() {
        const stat_channels = await this.db_get('stat_channels');

        const json = JSON.parse(stat_channels) ?? {};

        if (!['parent_channel', 'total_users_channel', 'unique_author_channel'].every((c) => Object.keys(json).includes(c))) {
            json.parent_channel = null;
            json.total_users_channel = null;
            json.unique_author_channel = null;
        }

        return json;
    }

    async set_stat_channels(stat_channels) {
        if (!['parent_channel', 'total_users_channel', 'unique_author_channel'].every((c) => Object.keys(stat_channels).includes(c)))
            throw new Error('stat_channels is missing required keys');

        await this.db_set('stat_channels', JSON.stringify(stat_channels));
    }

    async get_unique_authors() {
        return this._get_array_backed_db_storage('unique_authors');
    }

    async add_unique_author(user) {
        return this._add_array_backed_db_storage('unique_authors', user);
    }

    async remove_unique_author(user) {
        return this._remove_array_backed_db_storage('unique_authors', user);
    }
}

module.exports = BanterGuild;
