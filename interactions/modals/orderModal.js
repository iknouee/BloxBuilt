'use strict';

/**
 * Handles submission of the order modal (both generic and per-build variants).
 * Validates the Build ID, generates a sequential order ID that survives
 * restarts (stored in state.nextOrderId), creates the private ticket, persists
 * the order, updates the queue, and logs.
 */

const { MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const ticketService = require('../../utils/ticketService');
const orderService = require('../../utils/orderService');
const { logAction, logger } = require('../../utils/logger');
const { IDS, ORDER_STATUS } = require('../../utils/constants');

function register(router) {
  router.modal(IDS.ORDER_MODAL, async (interaction, client, parts) => {
    // parts: ['order','modal', ...maybe buildId]
    const buildIdFromCustomId = parts.slice(2).join(':') || null;

    // Re-check ordering state at submit time (could have changed).
    const state = cache.getState();
    if (!state.ordersOpen) {
      return interaction.reply({
        content: '🔴 Orders are currently closed.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (cache.findActiveOrderByCustomer(interaction.user.id)) {
      return interaction.reply({
        content: 'You already have an active order.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const roblox = interaction.fields.getTextInputValue('roblox').trim();
    const budget = interaction.fields.getTextInputValue('budget').trim();
    const availability = interaction.fields.getTextInputValue('availability').trim();
    let gamepasses = '';
    try {
      gamepasses = interaction.fields.getTextInputValue('gamepasses').trim();
    } catch (_) {
      gamepasses = '';
    }

    const buildId = (buildIdFromCustomId || interaction.fields.getTextInputValue('buildId')).trim();

    // Validate build ID against stored builds.
    const build = cache.findActiveBuild(buildId);
    if (!build) {
      return interaction.reply({
        content: `⚠️ \`${buildId}\` is not a valid available Build ID. Check the available builds and try again.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Sequential order ID from persistent state.
    const orderId = state.nextOrderId;
    const order = {
      orderId,
      displayId: `#${String(orderId).padStart(4, '0')}`,
      customerId: interaction.user.id,
      robloxUsername: roblox,
      buildId: build.id,
      budget,
      gamepasses,
      availability,
      status: ORDER_STATUS.WAITING.key,
      builderId: null,
      acceptedBy: null,
      acceptedAt: null,
      channelId: null,
      messageId: null,
      reviewed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      cancelledAt: null,
    };

    // Create the ticket channel first so we can store its IDs with the order.
    let ticket;
    try {
      ticket = await ticketService.createOrderTicket(interaction.guild, order);
    } catch (err) {
      logger.error('Failed to create order ticket:', err?.message || err);
      return interaction.editReply(
        '⚠️ I could not create your order ticket. Please contact staff — this usually means I am missing the Manage Channels permission.',
      );
    }

    // Commit: bump the counter and store the order.
    state.nextOrderId = orderId + 1;
    cache.getOrders().orders.push(order);

    const savedOrders = await storage.saveOrders(client);
    const savedState = await storage.saveState(client);
    if (!savedOrders || !savedState) {
      // Persist failed — tell the customer but keep the ticket (staff can still
      // work it; data will re-persist on next successful save).
      logger.error(`Order ${order.displayId} created but storage save failed.`);
    }

    await orderService.refreshQueue(client);

    // Notify the new-orders staff channel if configured.
    const newOrdersId = cache.getConfig()?.channels?.newOrders;
    if (newOrdersId) {
      const ch = await client.channels.fetch(newOrdersId).catch(() => null);
      if (ch && ch.isTextBased()) {
        await ch
          .send({
            content: `📥 New order ${order.displayId} — ${build.id} by <@${order.customerId}> → ${ticket.channel}`,
          })
          .catch(() => {});
      }
    }

    await logAction(client, 'Order Created', `${order.displayId} — ${build.id}`, {
      fields: [
        { name: 'Customer', value: `<@${order.customerId}>`, inline: true },
        { name: 'Build', value: build.id, inline: true },
        { name: 'Ticket', value: `${ticket.channel}`, inline: true },
      ],
    });

    return interaction.editReply(
      `✅ Your order ${order.displayId} has been created: ${ticket.channel}`,
    );
  });
}

module.exports = { register };
