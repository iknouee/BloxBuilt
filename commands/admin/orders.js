'use strict';

/**
 * /orders open|close|status — control whether new build orders can be placed.
 * State is stored in Discord storage and the queue is refreshed on change.
 *
 * Owner / Management only.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const orderService = require('../../utils/orderService');
const embeds = require('../../utils/embeds');
const { isManagement } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

const data = new SlashCommandBuilder()
  .setName('orders')
  .setDescription('Open or close build ordering (management only)')
  .addSubcommand((s) => s.setName('open').setDescription('Open build orders'))
  .addSubcommand((s) => s.setName('close').setDescription('Close build orders'))
  .addSubcommand((s) => s.setName('status').setDescription('Show whether orders are open'));

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  const state = cache.getState();

  if (sub === 'status') {
    return interaction.reply({
      content: state.ordersOpen ? '🟢 Orders are **Open**.' : '🔴 Orders are **Closed**.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!isManagement(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only Management can open or close orders.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const open = sub === 'open';
  state.ordersOpen = open;
  const ok = await storage.saveState(client);
  if (!ok) {
    return interaction.reply({
      content: '⚠️ Failed to save state to storage. No change applied.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await orderService.refreshQueue(client);
  await logAction(client, open ? 'Orders Opened' : 'Orders Closed', `By <@${interaction.user.id}>.`);

  const embed = embeds.noticeEmbed(
    open ? '🟢 Orders Open' : '🔴 Orders Closed',
    open
      ? 'Customers can now place build orders.'
      : 'Build orders are now closed. Support tickets can still be opened.',
  );
  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
