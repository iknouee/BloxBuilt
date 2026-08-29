'use strict';

/**
 * Ticket creation + closing logic shared by order and support flows.
 *
 * Handles channel permission overwrites (customer + relevant staff roles + bot
 * only), transcript generation on close, logging, and short-delay deletion.
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const cache = require('../storage/cache');
const storage = require('../storage/discordStorage');
const embeds = require('./embeds');
const orderService = require('./orderService');
const { generateTranscript } = require('./transcripts');
const { logAction, logger } = require('./logger');
const { ORDER_STATUS } = require('./constants');

/**
 * Build permission overwrites for a private ticket.
 * @param {import('discord.js').Guild} guild
 * @param {string} customerId
 * @param {string[]} staffRoleKeys config role keys allowed to view
 */
function ticketOverwrites(guild, customerId, staffRoleKeys) {
  const config = cache.getConfig();
  const botId = guild.members.me?.id ?? guild.client.user.id;

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: customerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  for (const key of staffRoleKeys) {
    const roleId = config?.roles?.[key];
    if (roleId && guild.roles.cache.has(roleId)) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      });
    }
  }
  return overwrites;
}

/**
 * Create an order ticket channel and post the ticket embed.
 * @returns {Promise<{channel: import('discord.js').TextChannel, message: import('discord.js').Message}>}
 */
async function createOrderTicket(guild, order) {
  const overwrites = ticketOverwrites(guild, order.customerId, [
    'builder',
    'support',
    'management',
    'owner',
  ]);

  const channel = await guild.channels.create({
    name: `order-${String(order.orderId).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    topic: `BloxBuilt order ${order.displayId} • customer ${order.customerId}`,
  });

  const message = await channel.send({
    content: `<@${order.customerId}>`,
    embeds: [embeds.orderTicketEmbed(order)],
    components: embeds.orderTicketComponents(order),
  });

  order.channelId = channel.id;
  order.messageId = message.id;
  return { channel, message };
}

/**
 * Create a support ticket channel.
 */
async function createSupportTicket(guild, supportId, customerId, topic) {
  const overwrites = ticketOverwrites(guild, customerId, ['support', 'management', 'owner']);

  const channel = await guild.channels.create({
    name: `support-${String(supportId).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    topic: `BloxBuilt support #${String(supportId).padStart(4, '0')} • ${customerId}`,
  });

  const message = await channel.send({
    content: `<@${customerId}>`,
    embeds: [embeds.supportTicketEmbed(supportId, customerId, topic)],
    components: embeds.supportTicketComponents(supportId),
  });

  return { channel, message };
}

/**
 * Close a ticket: generate transcript, send it to order-logs, then delete the
 * channel after a short delay. For order tickets a summary is included.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @param {object} [opts]
 * @param {object} [opts.order] the order (for order tickets)
 * @param {string} [opts.closedBy]
 */
async function closeTicket(client, channel, opts = {}) {
  const { order, closedBy } = opts;

  // Generate transcript first.
  let transcript = null;
  try {
    transcript = await generateTranscript(channel);
  } catch (err) {
    logger.warn('Transcript generation failed:', err?.message || err);
  }

  const logsChannelId = cache.getConfig()?.channels?.orderLogs;
  const logsChannel = logsChannelId
    ? await client.channels.fetch(logsChannelId).catch(() => null)
    : null;

  if (logsChannel && logsChannel.isTextBased()) {
    const fields = [];
    if (order) {
      fields.push(
        { name: 'Order', value: order.displayId, inline: true },
        { name: 'Customer', value: `<@${order.customerId}>`, inline: true },
        { name: 'Roblox Username', value: order.robloxUsername || '—', inline: true },
        { name: 'Build', value: order.buildId || '—', inline: true },
        {
          name: 'Builder',
          value: order.builderId ? `<@${order.builderId}>` : 'None',
          inline: true,
        },
        { name: 'Final Status', value: embeds.statusText(order.status), inline: true },
      );
    }
    const embed = embeds
      .base()
      .setTitle(order ? `📋 Order ${order.displayId} — Transcript` : '📋 Support Ticket — Transcript')
      .setDescription(`Ticket \`#${channel.name}\` closed${closedBy ? ` by <@${closedBy}>` : ''}.`)
      .setTimestamp();
    if (fields.length) embed.addFields(fields);

    await logsChannel
      .send({ embeds: [embed], files: transcript ? [transcript.attachment] : [] })
      .catch((e) => logger.warn('Failed to send transcript:', e?.message || e));
  }

  await logAction(
    client,
    'Ticket Closed',
    `\`#${channel.name}\` closed${closedBy ? ` by <@${closedBy}>` : ''}.`,
  );

  // Delete after a short delay so participants can see it's closing.
  setTimeout(() => {
    channel.delete().catch((e) => logger.warn('Failed to delete ticket channel:', e?.message || e));
  }, 5000);
}

module.exports = {
  ticketOverwrites,
  createOrderTicket,
  createSupportTicket,
  closeTicket,
};
