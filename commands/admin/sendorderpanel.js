'use strict';

/**
 * /sendorderpanel — post the persistent order panel to the configured orders
 * channel. Owner / Management only. The panel buttons are persistent (routed
 * by custom ID), so they keep working after any restart.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const embeds = require('../../utils/embeds');
const { isManagement } = require('../../utils/permissions');

const data = new SlashCommandBuilder()
  .setName('sendorderpanel')
  .setDescription('Send the order panel to the configured orders channel (management only)');

async function execute(interaction, client) {
  if (!isManagement(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only Owner/Management can send the order panel.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channelId = cache.getConfig()?.channels?.orders;
  if (!channelId) {
    return interaction.reply({
      content: '⚠️ Orders channel not configured. Run `/config channel orders` first.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return interaction.reply({
      content: '⚠️ Configured orders channel is unavailable.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const message = await channel.send({
    embeds: [embeds.orderPanelEmbed()],
    components: embeds.orderPanelComponents(),
  });

  const state = cache.getState();
  state.orderPanelMessageId = message.id;
  state.orderPanelChannelId = channel.id;
  await storage.saveState(client);

  return interaction.reply({
    content: `✅ Order panel sent to ${channel}.`,
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { data, execute };
