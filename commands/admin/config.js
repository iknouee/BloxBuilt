'use strict';

/**
 * /config — configure channels, roles, verification and view current config.
 * Uses Discord channel/role option selectors (no typing IDs). Every change is
 * persisted to Discord storage immediately.
 *
 * Owner only.
 */

const {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const embeds = require('../../utils/embeds');
const { isOwner } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');
const { CHANNEL_LABELS, ROLE_LABELS } = require('../../utils/constants');

// Maps the user-facing choice value to the config key.
const CHANNEL_CHOICES = [
  { name: 'welcome', value: 'welcome' },
  { name: 'orders', value: 'orders' },
  { name: 'queue', value: 'queue' },
  { name: 'builds', value: 'builds' },
  { name: 'reviews', value: 'reviews' },
  { name: 'order-logs', value: 'orderLogs' },
  { name: 'new-orders', value: 'newOrders' },
  { name: 'announcements', value: 'announcements' },
];

const ROLE_CHOICES = [
  { name: 'owner', value: 'owner' },
  { name: 'management', value: 'management' },
  { name: 'builder', value: 'builder' },
  { name: 'support', value: 'support' },
  { name: 'customer', value: 'customer' },
  { name: 'member', value: 'member' },
  { name: 'verified', value: 'verified' },
];

const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure BloxBuilt (owner only)')
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('Set a channel')
      .addStringOption((o) =>
        o
          .setName('key')
          .setDescription('Which channel to set')
          .setRequired(true)
          .addChoices(...CHANNEL_CHOICES),
      )
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('The channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('role')
      .setDescription('Set a role')
      .addStringOption((o) =>
        o
          .setName('key')
          .setDescription('Which role to set')
          .setRequired(true)
          .addChoices(...ROLE_CHOICES),
      )
      .addRoleOption((o) => o.setName('role').setDescription('The role').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('verification')
      .setDescription('Enable or disable auto-verify on join')
      .addBooleanOption((o) =>
        o.setName('enabled').setDescription('Enable auto verify').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('banner')
      .setDescription('Set the banner image URL used on embeds')
      .addStringOption((o) =>
        o
          .setName('url')
          .setDescription('Direct image URL (leave blank to reset to default)')
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('view').setDescription('View current configuration'));

async function execute(interaction, client) {
  if (!isOwner(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only the Owner can use `/config`.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const sub = interaction.options.getSubcommand();
  const config = cache.getConfig();

  if (sub === 'channel') {
    const key = interaction.options.getString('key');
    const channel = interaction.options.getChannel('channel');
    config.channels[key] = channel.id;
    const ok = await storage.saveConfig(client);
    if (!ok) {
      return interaction.reply({
        content: '⚠️ Failed to save configuration to storage. No changes were persisted.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await logAction(client, 'Config Updated', `Channel **${key}** set to ${channel}.`);
    return interaction.reply({
      content: `✅ ${CHANNEL_LABELS[key] || key} channel set to ${channel}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'role') {
    const key = interaction.options.getString('key');
    const role = interaction.options.getRole('role');
    config.roles[key] = role.id;
    const ok = await storage.saveConfig(client);
    if (!ok) {
      return interaction.reply({
        content: '⚠️ Failed to save configuration to storage. No changes were persisted.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await logAction(client, 'Config Updated', `Role **${key}** set to ${role}.`);
    return interaction.reply({
      content: `✅ ${ROLE_LABELS[key] || key} role set to ${role}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'verification') {
    const enabled = interaction.options.getBoolean('enabled');
    config.settings.autoVerify = enabled;
    const ok = await storage.saveConfig(client);
    if (!ok) {
      return interaction.reply({
        content: '⚠️ Failed to save configuration to storage.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await logAction(client, 'Config Updated', `Auto-verify **${enabled ? 'enabled' : 'disabled'}**.`);
    return interaction.reply({
      content: `✅ Auto-verify ${enabled ? 'enabled' : 'disabled'}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'banner') {
    const url = interaction.options.getString('url') || '';
    if (url && !/^https?:\/\//i.test(url)) {
      return interaction.reply({
        content: '⚠️ Please provide a valid image URL starting with http(s)://',
        flags: MessageFlags.Ephemeral,
      });
    }
    config.settings.bannerUrl = url;
    const ok = await storage.saveConfig(client);
    if (!ok) {
      return interaction.reply({
        content: '⚠️ Failed to save configuration to storage.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await logAction(client, 'Config Updated', url ? 'Banner URL set.' : 'Banner reset to default.');
    return interaction.reply({
      content: url
        ? `✅ Banner image updated.\n\n> Tip: Discord CDN links expire. Host the image on your website for a permanent banner.`
        : '✅ Banner reset to the default image.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'view') {
    const ch = (k) => (config.channels[k] ? `<#${config.channels[k]}>` : '`not set`');
    const rl = (k) => (config.roles[k] ? `<@&${config.roles[k]}>` : '`not set`');
    const state = cache.getState();
    const storageStatus = cache.isStorageReady() ? '🟢 Connected' : '🔴 Not connected';

    const embed = embeds
      .base()
      .setTitle('⚙️ BloxBuilt Configuration')
      .addFields(
        {
          name: 'CHANNELS',
          value:
            `Welcome: ${ch('welcome')}\n` +
            `Orders: ${ch('orders')}\n` +
            `Queue: ${ch('queue')}\n` +
            `Builds: ${ch('builds')}\n` +
            `Reviews: ${ch('reviews')}\n` +
            `Logs: ${ch('orderLogs')}`,
          inline: false,
        },
        {
          name: 'ROLES',
          value:
            `Owner: ${rl('owner')}\n` +
            `Management: ${rl('management')}\n` +
            `Builder: ${rl('builder')}\n` +
            `Support: ${rl('support')}\n` +
            `Customer: ${rl('customer')}\n` +
            `Member: ${rl('member')}\n` +
            `Verified: ${rl('verified')}`,
          inline: false,
        },
        {
          name: 'SETTINGS',
          value:
            `Auto Verify: **${config.settings.autoVerify ? 'Enabled' : 'Disabled'}**\n` +
            `Orders: **${state.ordersOpen ? 'Open' : 'Closed'}**\n` +
            `Storage: ${storageStatus}`,
          inline: false,
        },
      );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
