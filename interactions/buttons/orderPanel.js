'use strict';

/**
 * Persistent order-panel buttons + the per-build "Order This Build" button.
 * These show a modal to collect the customer's details. Because they are
 * matched purely by custom ID, they keep working forever (no collectors).
 *
 *   order:create            → generic order modal (asks for Build ID)
 *   build:order:<buildId>   → pre-filled build modal (Build ID already known)
 *   order:support           → support topic modal
 */

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');
const cache = require('../../storage/cache');
const { IDS } = require('../../utils/constants');

function buildInput(id, label, style, required, placeholder, maxLength) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(required);
  if (placeholder) input.setPlaceholder(placeholder);
  if (maxLength) input.setMaxLength(maxLength);
  return new ActionRowBuilder().addComponents(input);
}

/**
 * Build the order modal. If buildId is provided the Build ID field is omitted
 * (we already know it), keeping the modal within Discord's 5-input limit.
 */
function orderModal(buildId) {
  const customId = buildId ? `${IDS.ORDER_MODAL}:${buildId}` : IDS.ORDER_MODAL;
  const modal = new ModalBuilder().setCustomId(customId).setTitle('🏡 Order a BloxBuilt House');

  const rows = [buildInput('roblox', 'Roblox Username', TextInputStyle.Short, true, 'Your Roblox username', 60)];

  if (!buildId) {
    rows.push(buildInput('buildId', 'Build ID', TextInputStyle.Short, true, 'e.g. BB-001', 20));
  }

  rows.push(
    buildInput('budget', 'Bloxburg Budget', TextInputStyle.Short, true, 'e.g. $250,000', 40),
    buildInput('gamepasses', 'Gamepasses Owned', TextInputStyle.Paragraph, false, 'e.g. Advanced Placement, Multiple Floors', 300),
    buildInput('availability', 'Availability', TextInputStyle.Short, true, 'e.g. 6 PM - 10 PM UK', 100),
  );

  modal.addComponents(...rows);
  return modal;
}

function supportModal() {
  const modal = new ModalBuilder().setCustomId(IDS.SUPPORT_MODAL).setTitle('❓ Order Support');
  modal.addComponents(
    buildInput('topic', 'What do you need help with?', TextInputStyle.Paragraph, true, 'Describe your issue', 1000),
  );
  return modal;
}

async function ensureCanOrder(interaction) {
  const state = cache.getState();
  if (!state.ordersOpen) {
    await interaction.reply({
      content: '🔴 BloxBuilt orders are currently closed.\n\nPlease check back later.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  const existing = cache.findActiveOrderByCustomer(interaction.user.id);
  if (existing) {
    const link = existing.channelId ? `<#${existing.channelId}>` : `order ${existing.displayId}`;
    await interaction.reply({
      content: `You already have an active order (${existing.displayId}). See ${link}.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

function register(router) {
  // Generic "Order a Build" button.
  router.button(IDS.ORDER_CREATE, async (interaction) => {
    if (!(await ensureCanOrder(interaction))) return;
    await interaction.showModal(orderModal(null));
  });

  // "Order This Build" button on a listing — build ID embedded in custom ID.
  router.button(IDS.BUILD_ORDER, async (interaction, client, parts) => {
    const buildId = parts.slice(2).join(':');
    const build = cache.findActiveBuild(buildId);
    if (!build) {
      return interaction.reply({
        content: '⚠️ That build is no longer available.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!(await ensureCanOrder(interaction))) return;
    await interaction.showModal(orderModal(build.id));
  });

  // "Order Support" button.
  router.button(IDS.ORDER_SUPPORT, async (interaction) => {
    await interaction.showModal(supportModal());
  });
}

module.exports = { register, orderModal, supportModal };
