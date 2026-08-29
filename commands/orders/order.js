'use strict';

/**
 * /order lookup|assign|status|close — staff tools for individual orders.
 *
 *  - lookup: view any order's details (staff).
 *  - assign: assign a builder (management).
 *  - status: force a status change (staff — builders can progress builds).
 *  - close:  close the order's ticket, generating a transcript (staff).
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const orderService = require('../../utils/orderService');
const ticketService = require('../../utils/ticketService');
const embeds = require('../../utils/embeds');
const { isStaff, isManagement } = require('../../utils/permissions');
const { ORDER_STATUS } = require('../../utils/constants');

const STATUS_CHOICES = Object.values(ORDER_STATUS).map((s) => ({
  name: `${s.emoji} ${s.label}`,
  value: s.key,
}));

const data = new SlashCommandBuilder()
  .setName('order')
  .setDescription('Manage individual build orders (staff)')
  .addSubcommand((s) =>
    s
      .setName('lookup')
      .setDescription('Look up an order')
      .addIntegerOption((o) => o.setName('id').setDescription('Order number, e.g. 1').setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('assign')
      .setDescription('Assign a builder to an order (management)')
      .addIntegerOption((o) => o.setName('id').setDescription('Order number').setRequired(true))
      .addUserOption((o) => o.setName('builder').setDescription('Builder to assign').setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName('status')
      .setDescription('Set an order status')
      .addIntegerOption((o) => o.setName('id').setDescription('Order number').setRequired(true))
      .addStringOption((o) =>
        o.setName('status').setDescription('New status').setRequired(true).addChoices(...STATUS_CHOICES),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('close')
      .setDescription('Close an order ticket')
      .addIntegerOption((o) => o.setName('id').setDescription('Order number').setRequired(true)),
  );

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();

  if (!isStaff(interaction.member)) {
    return interaction.reply({
      content: '🔒 This command is for staff only.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const id = interaction.options.getInteger('id');
  const order = cache.findOrder(id);
  if (!order) {
    return interaction.reply({
      content: `⚠️ No order found with number \`#${String(id).padStart(4, '0')}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'lookup') {
    return interaction.reply({ embeds: [embeds.orderTicketEmbed(order)], flags: MessageFlags.Ephemeral });
  }

  if (sub === 'assign') {
    if (!isManagement(interaction.member)) {
      return interaction.reply({
        content: '🔒 Only Management can assign builders.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const builder = interaction.options.getUser('builder');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await orderService.assignBuilder(client, order, builder.id, interaction.user.id);
    if (!ok) return interaction.editReply('⚠️ Failed to persist assignment.');
    return interaction.editReply(`✅ Assigned <@${builder.id}> to order ${order.displayId}.`);
  }

  if (sub === 'status') {
    const statusKey = interaction.options.getString('status');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await orderService.setStatus(client, order, statusKey, { actorId: interaction.user.id });
    if (!ok) return interaction.editReply('⚠️ Failed to persist status change.');
    return interaction.editReply(`✅ Order ${order.displayId} set to ${embeds.statusText(statusKey)}.`);
  }

  if (sub === 'close') {
    if (!order.channelId) {
      return interaction.reply({
        content: 'This order has no active ticket channel.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const channel = await client.channels.fetch(order.channelId).catch(() => null);
    if (!channel) {
      return interaction.reply({
        content: 'The order ticket channel no longer exists.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.reply({
      content: `🔒 Closing order ${order.displayId}. A transcript will be saved.`,
      flags: MessageFlags.Ephemeral,
    });
    // Clear the live ticket reference; historical order data remains in storage.
    order.channelId = null;
    order.messageId = null;
    await storage.saveOrders(client);
    await ticketService.closeTicket(client, channel, { order, closedBy: interaction.user.id });
    return undefined;
  }

  return interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
