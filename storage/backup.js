'use strict';

/**
 * Full-data backup helper. Produces one JSON file containing every BloxBuilt
 * record plus metadata, and uploads it to the private storage channel. The
 * backup is additive — it never touches the live records.
 */

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const cache = require('./cache');
const { BRAND_COLOR } = require('../utils/constants');
const { logger } = require('../utils/logger');

/**
 * Build the combined backup payload from the in-memory cache.
 */
function buildBackupObject() {
  return {
    meta: {
      brand: 'BloxBuilt',
      version: 1,
      createdAt: new Date().toISOString(),
    },
    config: cache.getConfig(),
    builds: cache.getBuilds(),
    orders: cache.getOrders(),
    reviews: cache.getReviews(),
    state: cache.getState(),
  };
}

function backupFilename(date = new Date()) {
  const iso = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `bloxbuilt-backup-${iso}.json`;
}

/**
 * Create and upload a full backup to the storage channel.
 * @param {import('discord.js').Client} client
 * @returns {Promise<{ok:boolean, filename?:string, error?:string}>}
 */
async function backupData(client) {
  const channelId = cache.getStorageChannelId();
  if (!channelId) return { ok: false, error: 'Storage channel unknown.' };

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return { ok: false, error: 'Storage channel unavailable.' };

  const now = new Date();
  const obj = buildBackupObject();
  const filename = backupFilename(now);

  try {
    const json = JSON.stringify(obj, null, 2);
    const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: filename });

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('💾 BloxBuilt Backup')
      .setDescription('Full data backup created.')
      .addFields(
        { name: 'Builds', value: String(obj.builds.builds.length), inline: true },
        { name: 'Orders', value: String(obj.orders.orders.length), inline: true },
        { name: 'Reviews', value: String(obj.reviews.reviews.length), inline: true },
      )
      .setTimestamp(now);

    await channel.send({ embeds: [embed], files: [file] });

    cache.getState().lastBackup = now.toISOString();
    return { ok: true, filename };
  } catch (err) {
    logger.error('Backup failed:', err?.message || err);
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

module.exports = { backupData, buildBackupObject, backupFilename };
