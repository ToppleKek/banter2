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
        this.channel_bindings = new Map();
        this.channel_bind_messages = new Map();
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

        // Cache channel bindings
        this.db.get('SELECT channel_bindings FROM servers WHERE id = ?', id, (err, row) => {
            if (!err && row && row['channel_bindings'] !== undefined) {
                const bindings = JSON.parse(row['channel_bindings']);

                if (!bindings)
                    return;

                for (const binding of bindings)
                    this.channel_bindings.set(binding.from, binding.to);
            }
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
                        Logger.error(err);
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

            await pledge(log_channel.send({embeds: [{
                title: `${entry?.executor?.tag ?? 'Someone'} tried to delete a log entry!`,
                description: `Attempting to resend entry in next message`,
                color: 0xFFAA00
            }]}));

            console.dir(embed_options);
            await pledge(log_channel.send({embeds: [embed_options]}));
            return;
        }

        const embed = { // TODO: what else is generic in logs?
            timestamp: new Date().toISOString(),
        };

        Object.assign(embed, embed_options);
        await pledge(log_channel.send({embeds: [embed]}));
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
                iconURL: mod.displayAvatarURL({ size: 2048, dynamic: true, format: 'png' }),
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

        await pledge(mod_log_channel.send({embeds: [embed]}));
    }

    async temp_ban(user, author, duration, seconds, reason = 'No reason provided') {
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

        this.dguild.bans.create(user, { deleteMessageSeconds: seconds, reason });

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

    async _get_object_backed_db_storage(key) {
        let [err, db_response] = await pledge(this.db_get(key));

        if (!db_response)
            db_response = '{}';

        return err ? {} : JSON.parse(db_response);
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

    async get_naenae_stats() {
        return this._get_object_backed_db_storage('naenae_stats');
    }

    async add_naenae_stat(user_id, n) {
        const naenae_stats = await this.get_naenae_stats();

        if (!naenae_stats[user_id])
            naenae_stats[user_id] = 0;

        naenae_stats[user_id] += n;

        await this.db_set('naenae_stats', JSON.stringify(naenae_stats));
    }

    async reset_naenae_stats() {
        await this.db_set('naenae_stats', '{}');
    }

    async get_ban_stats() {
        return this._get_object_backed_db_storage('ban_stats');
    }

    async set_ban_stats(ban_stats) {
        await this.db_set('ban_stats', JSON.stringify(ban_stats));
    }

    async get_archived_ban_stats() {
        return this._get_array_backed_db_storage('archived_ban_stats');
    }

    async add_archived_ban_stats(ban_stats) {
        const values = await this._get_array_backed_db_storage('archived_ban_stats');

        values.push(ban_stats);

        if (values.length > 12)
            values.splice(0, 1);

        this.db_set('archived_ban_stats', JSON.stringify(values));
        return true;
    }

    async _remove_dead_channel_binds() {
        for (const [channel_id, webhook_id] of this.channel_bindings.entries()) {
            const [err, channel] = await pledge(this.bot.client.channels.fetch(channel_id));

            if (err) {
                this.remove_channel_bind(channel_id);
                Logger.info(`Removing dead channel binding: ${channel_id}`);
            }
        }
    }

    get_channel_bind(channel_id) {
        return this.channel_bindings.get(channel_id);
    }

    async add_channel_bind(channel_id, webhook_id) {
        await this._remove_dead_channel_binds();
        const bind = {from: channel_id, to: webhook_id};
        const ret = await this._add_array_backed_db_storage('channel_bindings', bind, (b) => b.from === channel_id);

        if (ret)
            this.channel_bindings.set(channel_id, webhook_id);

        return ret;
    }

    async remove_channel_bind(channel_id) {
        const webhook_id = this.channel_bindings.get(channel_id);
        const [err, webhook] = await pledge(this.bot.client.fetchWebhook(webhook_id));

        // Delete the webhook for this channel binding if it still exists
        if (!err)
            await pledge(webhook.delete());

        const ret = await this._remove_array_backed_db_storage('channel_bindings', channel_id, (b) => b.from === channel_id);
        if (ret)
            this.channel_bindings.delete(channel_id);

        return ret;
    }

    async get_whitelisted(action) {
        let [err, db_response] = await pledge(this.db_get('whitelist'));

        if (!db_response)
            db_response = '{}';

        const whitelist_rules = JSON.parse(db_response);
        return Object.keys(whitelist_rules).filter((id) => whitelist_rules[id][action]);
    }

    async get_whitelist_rules(id) {
        let [err, db_response] = await pledge(this.db_get('whitelist'));

        if (!db_response)
            db_response = '{}';

        const whitelist_rules = JSON.parse(db_response);
        return whitelist_rules[id] ?? { logAntiDelete: false, antiPing: false, antiSpam: false };
    }

    async whitelist_add(id, action) {
        let [err, db_response] = await pledge(this.db_get('whitelist'));

        if (!db_response)
            db_response = '{}';

        const whitelist_rules = JSON.parse(db_response);

        if (!whitelist_rules[id])
            whitelist_rules[id] = { logAntiDelete: false, antiPing: false, antiSpam: false };

        if (whitelist_rules[id][action])
            return false;


        whitelist_rules[id][action] = true;

        await this.db_set('whitelist', JSON.stringify(whitelist_rules));
        return true;
    }

    async whitelist_remove(id, action) {
        let [err, db_response] = await pledge(this.db_get('whitelist'));

        if (!db_response)
            db_response = '{}';

        const whitelist_rules = JSON.parse(db_response);

        if (!whitelist_rules[id])
            whitelist_rules[id] = { logAntiDelete: false, antiPing: false, antiSpam: false };

        if (!whitelist_rules[id][action])
            return false;

        whitelist_rules[id][action] = false;

        await this.db_set('whitelist', JSON.stringify(whitelist_rules));
        return true;
    }
}

module.exports = BanterGuild;
