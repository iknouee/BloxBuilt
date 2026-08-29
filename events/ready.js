'use strict';

/**
 * ready — fired once the client connects.
 *
 * Startup sequence (survives any Render redeploy because all data lives in
 * Discord):
 *   1. Resolve the configured GUILD_ID.
 *   2. Initialize storage: find/create the private data channel, load records.
 *   3. Warn the owner (via logs) if any record was corrupt.
 *   4. Refresh the queue message so it reflects reloaded state.
 */

const { Events } = require('discord.js');
const storage = require('../storage/discordStorage');
const cache = require('../storage/cache');
const orderService = require('../utils/orderService');
const { logger, logAction } = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);

    const guildId = process.env.GUILD_ID;
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
      guild = await client.guilds.fetch(guildId).catch(() => null);
    }
    if (!guild) {
      logger.error(`Configured GUILD_ID ${guildId} not found. Storage cannot initialize.`);
      return;
    }

    try {
      const result = await storage.initializeStorage(guild);
      logger.info('Storage initialized.');
      if (result.corrupt.length) {
        logger.error(`Corrupt storage records detected: ${result.corrupt.join(', ')}`);
        await logAction(
          client,
          '⚠️ Storage Needs Attention',
          `One or more storage records could not be read: **${result.corrupt.join(', ')}**.\n` +
            'The existing data was preserved (not overwritten). Please restore from a backup ' +
            'or investigate the affected record(s).',
          { color: 0xef4444 },
        );
      }
    } catch (err) {
      logger.error('Storage initialization failed:', err?.stack || err?.message || err);
      return;
    }

    // Reflect reloaded state in the queue message (recreates if it was deleted).
    await orderService.refreshQueue(client).catch(() => {});

    logger.info('BloxBuilt is ready.');

    // Set a simple presence.
    client.user.setActivity('🏡 Bloxburg builds', { type: 3 }).catch(() => {});
    // Expose readiness for /health accuracy.
    cache.setStorageReady(true);
  },
};
