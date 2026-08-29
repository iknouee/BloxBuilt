'use strict';

/**
 * "Leave a Review" button → review modal. Only the order's customer may review,
 * and only once per order (duplicate prevention).
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

function register(router) {
  router.button(IDS.REVIEW_CREATE, async (interaction, client, parts) => {
    const orderId = Number(parts[parts.length - 1]);
    const order = cache.findOrder(orderId);
    if (!order) {
      return interaction.reply({ content: '⚠️ Order not found.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.user.id !== order.customerId) {
      return interaction.reply({
        content: 'Only the customer for this order can leave a review.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (order.reviewed || cache.findReview(orderId)) {
      return interaction.reply({
        content: 'A review has already been submitted for this order. Thank you!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`${IDS.REVIEW_MODAL}:${orderId}`)
      .setTitle('⭐ Leave a Review');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rating')
          .setLabel('Rating (1-5)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1)
          .setPlaceholder('5'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('text')
          .setLabel('Review')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setPlaceholder('Tell us what you thought about your build'),
      ),
    );

    await interaction.showModal(modal);
  });
}

module.exports = { register };
