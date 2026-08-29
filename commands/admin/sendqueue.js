'use strict';

/**
 * /sendqueue — create the ONE persistent build-queue message in the configured
 * queue channel. Its message ID is stored in state so future changes edit the
 * same message instead of posting duplicates. Owner / Management only.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const embeds = require('../../utils/embeds');
const { isManagement } = require('../../utils/permissions');

const data = new SlashCommandBuilder()
  .setName('sendqueue')
  .setDescription('Create/refresh the persistent build queue message (management only)');

async function execute(interaction, client) {
  if (!isManagement(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only Owner/Management can send the queue.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channelId = cache.getConfig()?.channels?.queue;
  if (!channelId) {
    return interaction.reply({
      content: '⚠️ Queue channel not configured. Run `/config channel queue` first.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      content: '⚠️ Configured queue channel is unavailable.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const state = cache.getState();

  // If a queue message already exists and is reachable, just refresh it to
  // avoid duplicates.
  let existing = null;
  if (state.queueMessageId) {
    const prevChannel = state.queueChannelId
      ? await client.channels.fetch(state.queueChannelId).catch(() => null)
      : channel;
    if (prevChannel) {
      existing = await prevChannel.messages.fetch(state.queueMessageId).catch(() => null);
      if (existing && prevChannel.id === channel.id) {
        await existing.edit({ embeds: [embeds.queueEmbed()] });
        return interaction.reply({
          content: `✅ Existing queue message refreshed in ${channel}.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }

  const message = await channel.send({ embeds: [embeds.queueEmbed()] });
  state.queueMessageId = message.id;
  state.queueChannelId = channel.id;
  await storage.saveState(client);

  return interaction.reply({
    content: `✅ Queue message created in ${channel}.`,
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { data, execute };
