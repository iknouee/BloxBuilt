'use strict';

/**
 * Shared build listing operations. Posts a build listing to the configured
 * builds channel, updates the existing listing on edit (no duplicates), and
 * disables/removes it on removal.
 */

const cache = require('../storage/cache');
const embeds = require('./embeds');
const { logger } = require('./logger');

/**
 * Post a brand-new listing message for a build and record its location.
 * @param {import('discord.js').Client} client
 * @param {object} build
 */
async function postListing(client, build) {
  const channelId = cache.getConfig()?.channels?.builds;
  if (!channelId) return { ok: false, error: 'Builds channel not configured.' };

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return { ok: false, error: 'Builds channel unavailable.' };
  }

  const message = await channel.send({
    embeds: [embeds.buildListingEmbed(build)],
    components: embeds.buildListingComponents(build),
  });

  build.listingChannelId = channel.id;
  build.listingMessageId = message.id;
  return { ok: true, message };
}

/**
 * Update an existing listing in place; if the message is gone, repost.
 */
async function updateListing(client, build) {
  if (!build.listingChannelId || !build.listingMessageId) {
    return postListing(client, build);
  }
  const channel = await client.channels.fetch(build.listingChannelId).catch(() => null);
  if (!channel) return postListing(client, build);

  const message = await channel.messages.fetch(build.listingMessageId).catch(() => null);
  if (!message) return postListing(client, build);

  await message
    .edit({
      embeds: [embeds.buildListingEmbed(build)],
      components: embeds.buildListingComponents(build),
    })
    .catch((e) => logger.warn('updateListing edit failed:', e?.message || e));
  return { ok: true, message };
}

/**
 * Delete a build's listing message (used on removal).
 */
async function deleteListing(client, build) {
  if (!build.listingChannelId || !build.listingMessageId) return;
  const channel = await client.channels.fetch(build.listingChannelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(build.listingMessageId).catch(() => null);
  if (message) await message.delete().catch(() => {});
  build.listingChannelId = null;
  build.listingMessageId = null;
}

module.exports = { postListing, updateListing, deleteListing };
