'use strict';

/**
 * All reusable embed + component builders for BloxBuilt. Keeping presentation
 * here keeps commands/handlers focused on behaviour, and guarantees consistent
 * branding (blueprint blue, sparse emojis, short clean layouts).
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const {
  BRAND_COLOR,
  ORDER_STATUS,
  SUPPORT_STATUS,
  INACTIVE_STATUSES,
  IDS,
} = require('./constants');
const cache = require('../storage/cache');

function base() {
  return new EmbedBuilder().setColor(BRAND_COLOR);
}

function statusOf(key) {
  return ORDER_STATUS[key] || ORDER_STATUS.WAITING;
}

function statusText(key) {
  const s = statusOf(key);
  return `${s.emoji} ${s.label}`;
}

// ---------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------
function welcomeEmbed(member) {
  return base()
    .setTitle('🏡 Welcome to BloxBuilt')
    .setDescription(
      `Welcome, ${member}!\n\n` +
        'Get your dream Bloxburg home built quickly and easily.\n\n' +
        '🏠 Browse our available builds\n' +
        '🎟️ Open an order when you\'re ready\n' +
        '⭐ Check out our customer reviews',
    )
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Order panel
// ---------------------------------------------------------------------------
function orderPanelEmbed() {
  return base()
    .setTitle('🏡 Order a BloxBuilt House')
    .setDescription(
      'Choose one of our available builds, open an order and our team will help ' +
        'get your new Bloxburg home built.\n\n' +
        '**Before ordering:**\n' +
        '🏠 Browse our available builds\n' +
        '🔎 Find the Build ID you want\n' +
        '💰 Make sure you have enough Bloxburg money\n' +
        '🎮 Check the required gamepasses\n' +
        '🎫 Open your order when you\'re ready',
    );
}

function orderPanelComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.ORDER_CREATE)
      .setLabel('Order a Build')
      .setEmoji('🏡')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(IDS.ORDER_SUPPORT)
      .setLabel('Order Support')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Secondary),
  );
  return [row];
}

// ---------------------------------------------------------------------------
// Build listing
// ---------------------------------------------------------------------------
function buildListingEmbed(build) {
  const embed = base()
    .setTitle(`🏡 ${build.name}`)
    .addFields(
      { name: 'Build ID', value: build.id, inline: true },
      { name: '💰 Build Cost', value: build.cost || '—', inline: true },
      { name: '🏗️ Style', value: build.style || '—', inline: true },
      { name: '🛏️ Bedrooms', value: build.bedrooms || '—', inline: true },
      { name: '🚿 Bathrooms', value: build.bathrooms || '—', inline: true },
      { name: '🏢 Floors', value: build.floors || '—', inline: true },
      {
        name: '🎮 Required Gamepasses',
        value: build.gamepasses || 'None',
        inline: false,
      },
    );

  if (build.description) embed.setDescription(build.description);
  if (build.imageUrl) embed.setImage(build.imageUrl);
  return embed;
}

function buildListingComponents(build) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.BUILD_ORDER}:${build.id}`)
      .setLabel('Order This Build')
      .setEmoji('🏡')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!build.active),
  );
  return [row];
}

// ---------------------------------------------------------------------------
// Order ticket
// ---------------------------------------------------------------------------
function orderTicketEmbed(order) {
  const builderText = order.builderId ? `<@${order.builderId}>` : 'Not assigned';
  return base()
    .setTitle(`🏡 BloxBuilt Order ${order.displayId}`)
    .addFields(
      { name: 'Customer', value: `<@${order.customerId}>`, inline: true },
      { name: 'Roblox Username', value: order.robloxUsername || '—', inline: true },
      { name: 'Build', value: order.buildId || '—', inline: true },
      { name: 'Bloxburg Budget', value: order.budget || '—', inline: true },
      { name: 'Gamepasses', value: order.gamepasses || 'None', inline: true },
      { name: 'Availability', value: order.availability || '—', inline: true },
      { name: 'Status', value: statusText(order.status), inline: true },
      { name: 'Assigned Builder', value: builderText, inline: true },
      {
        name: 'Created',
        value: `<t:${Math.floor(new Date(order.createdAt).getTime() / 1000)}:F>`,
        inline: false,
      },
    );
}

function orderTicketComponents(order) {
  const done = INACTIVE_STATUSES.includes(order.status);
  const id = order.orderId;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_ACCEPT}:${id}`)
      .setLabel('Accept')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(done),
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_ASSIGN}:${id}`)
      .setLabel('Assign Builder')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(done),
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_START}:${id}`)
      .setLabel('Start Building')
      .setEmoji('🏗️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(done),
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_WAIT}:${id}`)
      .setLabel('Waiting for Customer')
      .setEmoji('⏳')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(done),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_COMPLETE}:${id}`)
      .setLabel('Complete')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(done),
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_CANCEL}:${id}`)
      .setLabel('Cancel')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(done),
    new ButtonBuilder()
      .setCustomId(`${IDS.ORDER_CLOSE}:${id}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

// ---------------------------------------------------------------------------
// Completion + review prompt
// ---------------------------------------------------------------------------
function completionEmbed() {
  return base()
    .setTitle('⭐ Your build has been completed!')
    .setDescription(
      'Thank you for using BloxBuilt.\n\n' +
        'We\'d love to hear what you thought about your build.',
    );
}

function reviewPromptComponents(orderId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.REVIEW_CREATE}:${orderId}`)
      .setLabel('Leave a Review')
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Primary),
  );
  return [row];
}

function reviewEmbed(review, customerId) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const embed = base()
    .setTitle('⭐ BloxBuilt Review')
    .setDescription(`${stars}\n\n"${review.text}"`)
    .addFields(
      { name: 'Customer', value: `<@${customerId}>`, inline: true },
      { name: 'Build', value: review.buildId || '—', inline: true },
      {
        name: 'Builder',
        value: review.builderId ? `<@${review.builderId}>` : '—',
        inline: true,
      },
      { name: 'Order', value: `#${String(review.orderId).padStart(4, '0')}`, inline: true },
    )
    .setTimestamp();
  return embed;
}

// ---------------------------------------------------------------------------
// Support ticket
// ---------------------------------------------------------------------------
function supportTicketEmbed(supportId, customerId, topic) {
  return base()
    .setTitle(`🎫 BloxBuilt Support #${String(supportId).padStart(4, '0')}`)
    .addFields(
      { name: 'Opened by', value: `<@${customerId}>`, inline: true },
      { name: 'Status', value: `${SUPPORT_STATUS.OPEN.emoji} ${SUPPORT_STATUS.OPEN.label}`, inline: true },
      { name: 'What they need help with', value: topic || '—', inline: false },
    )
    .setTimestamp();
}

function supportTicketComponents(supportId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.SUPPORT_CLAIM}:${supportId}`)
      .setLabel('Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${IDS.SUPPORT_CLOSE}:${supportId}`)
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );
  return [row];
}

// ---------------------------------------------------------------------------
// Build queue
// ---------------------------------------------------------------------------
function queueEmbed() {
  const state = cache.getState();
  const active = cache
    .getOrders()
    .orders.filter((o) => !INACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => a.orderId - b.orderId);

  const ordersLine = state.ordersOpen ? '🟢 Open' : '🔴 Closed';
  const embed = base().setTitle('🏗️ BloxBuilt Build Queue').setTimestamp();

  if (active.length === 0) {
    embed.setDescription(
      `There are currently no active builds.\n\n**Orders:** ${ordersLine}`,
    );
    return embed;
  }

  const lines = active
    .map((o) => `${o.displayId} • ${statusText(o.status)} • ${o.buildId || '—'}`)
    .join('\n');

  const waiting = active.filter((o) => o.status === ORDER_STATUS.WAITING.key).length;
  const building = active.filter((o) => o.status === ORDER_STATUS.BUILDING.key).length;

  embed.setDescription(
    `${lines}\n\n` +
      '━━━━━━━━━━━━━━━━\n\n' +
      `**Orders:** ${ordersLine}\n` +
      `**Waiting:** ${waiting}\n` +
      `**Building:** ${building}`,
  );
  return embed;
}

// ---------------------------------------------------------------------------
// Generic notice embeds
// ---------------------------------------------------------------------------
function noticeEmbed(title, description, color) {
  const e = base().setDescription(description);
  if (title) e.setTitle(title);
  if (color) e.setColor(color);
  return e;
}

module.exports = {
  base,
  statusText,
  welcomeEmbed,
  orderPanelEmbed,
  orderPanelComponents,
  buildListingEmbed,
  buildListingComponents,
  orderTicketEmbed,
  orderTicketComponents,
  completionEmbed,
  reviewPromptComponents,
  reviewEmbed,
  supportTicketEmbed,
  supportTicketComponents,
  queueEmbed,
  noticeEmbed,
};
