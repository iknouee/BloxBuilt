'use strict';

/**
 * Lightweight console logger with timestamps and levels, plus a helper to
 * send action/error logs to a configured Discord log channel.
 *
 * Discord channel logging is intentionally best-effort: a failure to log must
 * never take down the bot or interrupt the user-facing flow.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND_COLOR } = require('./constants');

function ts() {
  return new Date().toISOString();
}

const logger = {
  info(...args) {
    console.log(`[${ts()}] [INFO]`, ...args);
  },
  warn(...args) {
    console.warn(`[${ts()}] [WARN]`, ...args);
  },
  error(...args) {
    console.error(`[${ts()}] [ERROR]`, ...args);
  },
  debug(...args) {
    if (process.env.DEBUG) console.log(`[${ts()}] [DEBUG]`, ...args);
  },
};

/**
 * Sends a compact log embed to the configured order-logs channel.
 * Silently no-ops if the channel is not configured or unavailable.
 *
 * @param {import('discord.js').Client} client
 * @param {string} title e.g. "Order Created"
 * @param {string} description
 * @param {object} [opts]
 * @param {number} [opts.color]
 * @param {Array<{name:string,value:string,inline?:boolean}>} [opts.fields]
 */
async function logAction(client, title, description, opts = {}) {
  try {
    const cache = require('../storage/cache');
    const channelId = cache.getConfig()?.channels?.orderLogs;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(opts.color ?? BRAND_COLOR)
      .setTitle(title)
      .setTimestamp();

    if (description) embed.setDescription(description);
    if (Array.isArray(opts.fields) && opts.fields.length) embed.addFields(opts.fields);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn('Failed to send log to Discord log channel:', err?.message || err);
  }
}

module.exports = { logger, logAction };
