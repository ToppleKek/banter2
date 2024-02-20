const Logger = require("../logger");
const { pledge } = require("../utils/utils");

async function main() {
    const bot = this;
    const now = new Date();
    let errs, last_stat_day, last_ban_stat_month;
    [errs, [last_stat_day, last_ban_stat_month]] = await pledge([bot.db_get_global('last_stat_day'), bot.db_get_global('last_ban_stat_month')]);

    if (errs.length > 0) {
        Logger.error(errs);
        return;
    }

    [errs] = await pledge([bot.db_set_global('last_stat_day', now.getDate()), bot.db_set_global('last_ban_stat_month', now.getMonth())]);

    if (errs.length > 0) {
        Logger.error(errs);
        return;
    }

    const action = now.getDate() !== last_stat_day ? reset_stats : update_stats;
    const ban_stat_action = now.getMonth() !== last_ban_stat_month ? reset_ban_stats : update_ban_stats;

    for (const [id, bguild] of bot.guilds.entries()) {
        ban_stat_action(bot, bguild);

        let err, stat_channels;
        [err, stat_channels] = await pledge(bguild.get_stat_channels());

        if (err) {
            // Ignore this error, the channel is just not enabled
            // Logger.error(err);
            continue;
        }

        if (['parent_channel', 'total_users_channel', 'unique_author_channel'].every((c) => stat_channels[c] === null))
            continue;

        await action(bguild, stat_channels);
    }
}

async function reset_ban_stats(bot, bguild) {
    const now = new Date();

    // If someone banned someone in the last 5 minutes of the month...
    await pledge(update_ban_stats(bot, bguild, new Date(Date.now() - 24 * 60 * 60 * 1000)));

    let [err, [ban_stats, naenae_stats]] = await pledge([bguild.get_ban_stats(), bguild.get_naenae_stats()]);
    if (err.length > 0) {
        Logger.error(`Failed to get ban stats: ${err}`);
        return;
    }

    // Since we need to keep track of naenae commands separate from the audit log (otherwise the bot would take the stats from everyone who used naenae)
    // we merge them here before archiving them.
    for (const id in naenae_stats) {
        if (!ban_stats[id])
            ban_stats[id] = naenae_stats[id];
        else
            ban_stats[id] += naenae_stats[id];
    }

    let old_month = now.getMonth() - 1;
    let old_year = now.getFullYear();

    if (old_month < 0) {
        old_month = 11;
        --old_year;
    }

    await pledge(bguild.add_archived_ban_stats({
        month: old_month,
        year: old_year,
        stats: ban_stats
    }));

    await pledge([update_ban_stats(bot, bguild), bguild.reset_naenae_stats()]);
}

async function update_ban_stats(bot, bguild, now = new Date()) {
    const audit_logs = await get_bans_from_audit_log(bguild);
    if (!audit_logs) {
        return;
    }

    const this_months_bans = audit_logs.entries.filter((entry) => entry.createdAt.getMonth() === now.getMonth() && entry.executorId !== bot.client.user.id);
    const stat_map = {};
    for (const [entry_id, entry] of this_months_bans) {
        if (stat_map.hasOwnProperty(entry.executorId))
            ++stat_map[entry.executorId];
        else
            stat_map[entry.executorId] = 1;
    }

    await pledge(bguild.set_ban_stats(stat_map));
}

const MEMBER_BAN_ADD_AUDIT_LOG_EVENT = 22;
async function get_bans_from_audit_log(bguild) {
    let err, audit_logs;
    [err, audit_logs] = await pledge(bguild.dguild.fetchAuditLogs({ type: MEMBER_BAN_ADD_AUDIT_LOG_EVENT }));

    if (err) {
        Logger.error(`Audit log fetch error (guild=${bguild.id}): ${err}`);
        return null;
    }

    return audit_logs;
}

async function reset_stats(bguild, stat_channels) {
    Logger.debug('Resetting stats');
    const [err, unique_authors] = await pledge(bguild.get_unique_authors());

    if (err) {
        Logger.error(err);
        return;
    }

    await bguild.fetch_dguild();
    const [errs] = await pledge([
        bguild.db_set('last_unique_author_count', unique_authors.length),
        bguild.db_set('last_member_count', bguild.dguild.memberCount),
        bguild.db_set('unique_authors', '[]')
    ]);

    if (errs.length > 0) {
        errs.forEach((e) => Logger.error(e));
        return;
    }

    await edit_channels(bguild, stat_channels, `Users: ${bguild.dguild.memberCount} (0)`, `Active Today: 0 (-${unique_authors.length})`);
}

async function update_stats(bguild, stat_channels) {
    Logger.debug('Updating stats');

    let [errs, [last_unique_author_count, unique_authors, last_member_count]] = await pledge([
        bguild.db_get('last_unique_author_count'),
        bguild.get_unique_authors(),
        bguild.db_get('last_member_count')
    ]);

    if (errs.length > 0) {
        errs.forEach((e) => Logger.error(e));
        return;
    }

    await bguild.fetch_dguild();

    const member_count_change = bguild.dguild.memberCount - last_member_count;
    const unique_authors_change = unique_authors.length - last_unique_author_count;

    await edit_channels(bguild, stat_channels,
        `Users: ${bguild.dguild.memberCount} (${member_count_change > 0 ? '+' : ''}${member_count_change})`,
        `Active Today: ${unique_authors.length} (${unique_authors_change > 0 ? '+' : ''}${unique_authors_change})`
    );
}

async function edit_channels(bguild, stat_channels, total_users_text, unique_author_text) {
    Logger.debug(`Editing channels ${stat_channels.total_users_channel},${stat_channels.unique_author_channel} with ${total_users_text}, ${unique_author_text}`);
    let err, total_users_channel, unique_author_channel;
    [err, total_users_channel] = await pledge(bguild.dguild.channels.fetch(stat_channels.total_users_channel));

    if (err || !total_users_channel) {
        Logger.error(err); // TODO: Change to mod message when that is implemented
        // await disable_stats(bguild);
        return;
    }

    if (total_users_channel.name !== total_users_text) {
        [err] = await pledge(total_users_channel.edit({ name: total_users_text }));

        if (err) {
            Logger.debug(`Invalid stat channel in server id=${bguild.id}`);
            Logger.error(err);
            return;
        }
    }


    // We are done if the guild has the unique author stat turned off
    if (!stat_channels.unique_author_channel)
        return;

    [err, unique_author_channel] = await pledge(bguild.dguild.channels.fetch(stat_channels.unique_author_channel));

    if (err || !unique_author_channel) {
        Logger.error(err); // TODO: Change to mod message when that is implemented
        // await disable_stats(bguild);
        return;
    }

    if (unique_author_channel.name !== unique_author_text) {
        [err] = await pledge(unique_author_channel.edit({ name: unique_author_text }));

        if (err) {
            Logger.error(err);
            return;
        }
    }
}

async function disable_stats(bguild) {
    const [err] = await pledge(bguild.set_stat_channels({ parent_channel: null, total_users_channel: null, unique_author_channel: null }));

    if (err)
        Logger.error(err);
}


module.exports.main = main;
