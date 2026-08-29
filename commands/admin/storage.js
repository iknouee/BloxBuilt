'use strict';

/**
 * /storage status — show a diagnostic view of the storage system. Owner only.
 * Ephemeral.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const discordStorage = require('../../storage/discordStorage');
const embeds = require('../../utils/embeds');
const { isOwner } = require('../../utils/permissions');

const data = new SlashCommandBuilder()
  .setName('storage')
  .setDescription('BloxBuilt storage tools (owner only)')
  .addSubcommand((s) => s.setName('status').setDescription('Show storage status'));

async function execute(interaction) {
  if (!isOwner(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only the Owner can view storage status.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const state = cache.getState();
  const config = cache.getConfig();
  const channelId = cache.getStorageChannelId();
  const corrupt = discordStorage.corruptList();

  const fmt = (iso) => (iso ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>` : 'Never');
  const configLoaded =
    Object.keys(config.channels || {}).length > 0 || Object.keys(config.roles || {}).length > 0;

  const embed = embeds
    .base()
    .setTitle('💾 BloxBuilt Storage Status')
    .addFields(
      { name: 'Storage Channel', value: channelId ? `<#${channelId}>` : '`unknown`', inline: true },
      { name: 'Connected', value: cache.isStorageReady() ? '🟢 Yes' : '🔴 No', inline: true },
      { name: 'Config Loaded', value: configLoaded ? '🟢 Yes' : '⚪ Empty', inline: true },
      { name: 'Builds', value: String(cache.getBuilds().builds.length), inline: true },
      { name: 'Orders', value: String(cache.getOrders().orders.length), inline: true },
      { name: 'Reviews', value: String(cache.getReviews().reviews.length), inline: true },
      { name: 'Orders Open', value: state.ordersOpen ? '🟢 Open' : '🔴 Closed', inline: true },
      { name: 'Last Save', value: fmt(state.lastSave), inline: true },
      { name: 'Last Backup', value: fmt(state.lastBackup), inline: true },
    );

  if (corrupt.length) {
    embed.addFields({
      name: '⚠️ Corrupt Records',
      value: corrupt.join(', '),
      inline: false,
    });
    embed.setColor(0xef4444);
  }

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
