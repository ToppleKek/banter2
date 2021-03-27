const { GuildMember } = require('discord.js');
const CONFIG = require('../../config.json');

module.exports = {
    /**
     * Check if the given member has the given permissions
     * @param {GuildMember} member 
     * @param {Array<import('discord.js').PermissionResolvable>} permissions 
     * @return bool True if the member has permission
     */
    check_permissions(member, permissions) {
        if (permissions.length <= 0)
            return true;
        else if (permissions[0] === 'BOT_OWNER')
            return member.user.id === CONFIG.owner_id;

        return member.permissions.any(permissions, true);
    }
};