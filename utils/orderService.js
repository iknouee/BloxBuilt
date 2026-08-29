'use strict';

/**
 * Shared order/queue operations used by both slash commands and interaction
 * handlers, so status-change logic lives in exactly one place.
 *
 * Every status change follows the same contract:
 *   1. mutate the in-memory order
 *   2. persist orders (and state) to Discord storage
 *   3. refresh the ticket embed
 *   4. refresh the persistent queue message
 *   5. log the action
 */

const cache = require('../storage/cache');
const storage = require('../storage/discordStorage');
const embeds = require('./embeds');
const { logAction, logger } = require('./logger');
const { ORDER_STATUS, INACTIVE_STATUSES } = require('./constants');

/**
 * Update the order's ticket message embed + buttons in place.
 */
async function refreshTicket(client, order) {
  if (!order.channelId || !order.messageId) return;
  const channel = await client.channels.fetch(order.channelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(order.messageId).catch(() => null);
  if (!message) return;
  await message
    .edit({
      embeds: [embeds.orderTicketEmbed(order)],
      components: embeds.orderTicketComponents(order),
    })
    .catch((e) => logger.warn('refreshTicket edit failed:', e?.message || e));
}

/**
 * Ensure the persistent queue message exists and reflects current state.
 * Recreates the message if it was manually deleted, updating state storage.
 */
async function refreshQueue(client) {
  const state = cache.getState();
  const channelId = state.queueChannelId || cache.getConfig()?.channels?.queue;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = embeds.queueEmbed();

  let message = null;
  if (state.queueMessageId) {
    message = await channel.messages.fetch(state.queueMessageId).catch(() => null);
  }

  try {
    if (message) {
      await message.edit({ embeds: [embed] });
    } else {
      const created = await channel.send({ embeds: [embed] });
      state.queueMessageId = created.id;
      state.queueChannelId = channel.id;
      await storage.saveState(client);
    }
  } catch (err) {
    logger.warn('refreshQueue failed:', err?.message || err);
  }
}

/**
 * Core status transition. Persists, refreshes ticket + queue, logs.
 * @param {import('discord.js').Client} client
 * @param {object} order
 * @param {string} statusKey new ORDER_STATUS key
 * @param {object} [opts]
 * @param {string} [opts.actorId] staff member who triggered the change
 * @returns {Promise<boolean>}
 */
async function setStatus(client, order, statusKey, opts = {}) {
  const status = ORDER_STATUS[statusKey];
  if (!status) throw new Error(`Invalid status ${statusKey}`);

  order.status = statusKey;
  if (statusKey === ORDER_STATUS.ACCEPTED.key) {
    order.acceptedBy = opts.actorId || order.acceptedBy;
    order.acceptedAt = new Date().toISOString();
  }
  if (statusKey === ORDER_STATUS.COMPLETED.key) {
    order.completedAt = new Date().toISOString();
  }
  if (statusKey === ORDER_STATUS.CANCELLED.key) {
    order.cancelledAt = new Date().toISOString();
  }

  const saved = await storage.saveOrders(client);
  if (!saved) {
    logger.error(`Failed to persist status change for order ${order.displayId}`);
    return false;
  }
  cache.getState().lastSave = new Date().toISOString();
  await storage.saveState(client);

  await refreshTicket(client, order);
  await refreshQueue(client);

  await logAction(
    client,
    `Order ${order.displayId} → ${status.label}`,
    `${status.emoji} Status changed to **${status.label}**.`,
    {
      fields: [
        { name: 'Order', value: order.displayId, inline: true },
        { name: 'Build', value: order.buildId || '—', inline: true },
        {
          name: 'By',
          value: opts.actorId ? `<@${opts.actorId}>` : 'System',
          inline: true,
        },
      ],
    },
  );
  return true;
}

/**
 * Assign a builder to an order and persist/refresh/log.
 */
async function assignBuilder(client, order, builderId, actorId) {
  order.builderId = builderId;
  const saved = await storage.saveOrders(client);
  if (!saved) return false;
  await refreshTicket(client, order);
  await refreshQueue(client);
  await logAction(client, `Order ${order.displayId} — Builder Assigned`, `👤 <@${builderId}> assigned.`, {
    fields: [
      { name: 'Order', value: order.displayId, inline: true },
      { name: 'Builder', value: `<@${builderId}>`, inline: true },
      { name: 'By', value: actorId ? `<@${actorId}>` : 'System', inline: true },
    ],
  });
  return true;
}

module.exports = {
  refreshTicket,
  refreshQueue,
  setStatus,
  assignBuilder,
  INACTIVE_STATUSES,
};
