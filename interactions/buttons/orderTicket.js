'use strict';

/**
 * Persistent order-ticket action buttons. All are matched by custom ID
 * (`order:<action>:<orderId>`) so they survive restarts. Permission checks
 * ensure customers never get staff controls.
 */

const {
  MessageFlags,
  ActionRowBuilder,
  UserSelectMenuBuilder,
} = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const orderService = require('../../utils/orderService');
const ticketService = require('../../utils/ticketService');
const embeds = require('../../utils/embeds');
const { isStaff, isManagement } = require('../../utils/permissions');
const { logAction, logger } = require('../../utils/logger');
const { IDS, ORDER_STATUS } = require('../../utils/constants');

function getOrder(parts) {
  const orderId = Number(parts[parts.length - 1]);
  return cache.findOrder(orderId);
}

async function guardStaff(interaction) {
  if (!isStaff(interaction.member)) {
    await interaction.reply({
      content: '🔒 Only staff can use these controls.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

async function guardOrder(interaction, order) {
  if (!order) {
    await interaction.reply({
      content: '⚠️ This order could not be found in storage.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

function register(router) {
  // Accept
  router.button(IDS.ORDER_ACCEPT, async (interaction, client, parts) => {
    if (!(await guardStaff(interaction))) return;
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Auto-assign the accepting builder if nobody is assigned yet.
    if (!order.builderId) {
      order.builderId = interaction.user.id;
    }
    const ok = await orderService.setStatus(client, order, ORDER_STATUS.ACCEPTED.key, {
      actorId: interaction.user.id,
    });
    if (!ok) return interaction.editReply('⚠️ Failed to persist. Try again.');
    return interaction.editReply(`✅ You accepted order ${order.displayId}.`);
  });

  // Assign Builder → show a user select menu filtered to builders.
  router.button(IDS.ORDER_ASSIGN, async (interaction, client, parts) => {
    if (!isManagement(interaction.member)) {
      return interaction.reply({
        content: '🔒 Only Management can assign builders.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;

    const select = new UserSelectMenuBuilder()
      .setCustomId(`${IDS.ORDER_ASSIGN_SELECT}:${order.orderId}`)
      .setPlaceholder('Select a builder to assign')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({
      content: `Select a builder for order ${order.displayId}. They must have the Builder role.`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  });

  // Start Building
  router.button(IDS.ORDER_START, async (interaction, client, parts) => {
    if (!(await guardStaff(interaction))) return;
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await orderService.setStatus(client, order, ORDER_STATUS.BUILDING.key, {
      actorId: interaction.user.id,
    });
    if (!ok) return interaction.editReply('⚠️ Failed to persist.');
    return interaction.editReply(`🟣 Order ${order.displayId} is now building.`);
  });

  // Waiting for Customer
  router.button(IDS.ORDER_WAIT, async (interaction, client, parts) => {
    if (!(await guardStaff(interaction))) return;
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await orderService.setStatus(client, order, ORDER_STATUS.WAITING_CUSTOMER.key, {
      actorId: interaction.user.id,
    });
    if (!ok) return interaction.editReply('⚠️ Failed to persist.');
    return interaction.editReply(`🟠 Order ${order.displayId} is waiting for the customer.`);
  });

  // Complete
  router.button(IDS.ORDER_COMPLETE, async (interaction, client, parts) => {
    if (!(await guardStaff(interaction))) return;
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await orderService.setStatus(client, order, ORDER_STATUS.COMPLETED.key, {
      actorId: interaction.user.id,
    });
    if (!ok) return interaction.editReply('⚠️ Failed to persist.');

    // Give the customer the Customer role.
    const customerRoleId = cache.getConfig()?.roles?.customer;
    if (customerRoleId) {
      const member = await interaction.guild.members.fetch(order.customerId).catch(() => null);
      if (member && interaction.guild.roles.cache.has(customerRoleId)) {
        await member.roles.add(customerRoleId).catch((e) =>
          logger.warn('Failed to add customer role:', e?.message || e),
        );
      }
    }

    // Post the completion + review prompt in the ticket.
    if (order.channelId) {
      const ch = await client.channels.fetch(order.channelId).catch(() => null);
      if (ch && ch.isTextBased()) {
        await ch
          .send({
            content: `<@${order.customerId}>`,
            embeds: [embeds.completionEmbed()],
            components: embeds.reviewPromptComponents(order.orderId),
          })
          .catch(() => {});
      }
    }

    await logAction(client, 'Order Completed', `${order.displayId} — ${order.buildId}`, {
      color: 0x22c55e,
    });
    return interaction.editReply(`🟢 Order ${order.displayId} completed.`);
  });

  // Cancel
  router.button(IDS.ORDER_CANCEL, async (interaction, client, parts) => {
    if (!(await guardStaff(interaction))) return;
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ok = await orderService.setStatus(client, order, ORDER_STATUS.CANCELLED.key, {
      actorId: interaction.user.id,
    });
    if (!ok) return interaction.editReply('⚠️ Failed to persist.');
    await logAction(client, 'Order Cancelled', `${order.displayId} — ${order.buildId}`, {
      color: 0xef4444,
    });
    return interaction.editReply(`🔴 Order ${order.displayId} cancelled. You can close the ticket when ready.`);
  });

  // Close Ticket
  router.button(IDS.ORDER_CLOSE, async (interaction, client, parts) => {
    if (!(await guardStaff(interaction))) return;
    const order = getOrder(parts);
    if (!(await guardOrder(interaction, order))) return;

    const channel = interaction.channel;
    await interaction.reply({
      content: `🔒 Closing this ticket. A transcript will be saved to the logs channel.`,
      flags: MessageFlags.Ephemeral,
    });

    // Clear the live ticket reference but keep the historical order.
    order.channelId = null;
    order.messageId = null;
    await storage.saveOrders(client);
    await ticketService.closeTicket(client, channel, { order, closedBy: interaction.user.id });
  });
}

module.exports = { register };
