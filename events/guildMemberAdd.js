'use strict';

/**
 * guildMemberAdd — welcome flow.
 *   1. Give the configured Member role (if set).
 *   2. Optionally give Verified if auto-verify is enabled.
 *   3. Send a welcome embed to the configured welcome channel.
 *
 * Every step is guarded so a missing/deleted role or channel can't crash the
 * handler.
 */

const { Events } = require('discord.js');
const cache = require('../storage/cache');
const embeds = require('../utils/embeds');
const { logger } = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    // Only act for the configured guild.
    if (member.guild.id !== process.env.GUILD_ID) return;

    const config = cache.getConfig();

    // 1. Member role
    const memberRoleId = config?.roles?.member;
    if (memberRoleId && member.guild.roles.cache.has(memberRoleId)) {
      await member.roles.add(memberRoleId).catch((e) =>
        logger.warn(`Failed to add member role to ${member.id}:`, e?.message || e),
      );
    }

    // 2. Verified role (optional)
    if (config?.settings?.autoVerify) {
      const verifiedRoleId = config?.roles?.verified;
      if (verifiedRoleId && member.guild.roles.cache.has(verifiedRoleId)) {
        await member.roles.add(verifiedRoleId).catch((e) =>
          logger.warn(`Failed to add verified role to ${member.id}:`, e?.message || e),
        );
      }
    }

    // 3. Welcome message
    const welcomeChannelId = config?.channels?.welcome;
    if (!welcomeChannelId) return;
    const channel = await client.channels.fetch(welcomeChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel
      .send({ content: `${member}`, embeds: [embeds.welcomeEmbed(member)] })
      .catch((e) => logger.warn('Failed to send welcome message:', e?.message || e));
  },
};
