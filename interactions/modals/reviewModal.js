'use strict';

/**
 * Review modal submission. Validates the rating (1-5), prevents duplicate
 * reviews, persists the review to Discord storage, marks the order reviewed,
 * and posts the review to the configured reviews channel.
 */

const { MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const embeds = require('../../utils/embeds');
const { logAction } = require('../../utils/logger');
const { IDS } = require('../../utils/constants');

function register(router) {
  router.modal(IDS.REVIEW_MODAL, async (interaction, client, parts) => {
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

    // Duplicate prevention.
    if (order.reviewed || cache.findReview(orderId)) {
      return interaction.reply({
        content: 'A review has already been submitted for this order.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const ratingRaw = interaction.fields.getTextInputValue('rating').trim();
    const rating = Number(ratingRaw);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return interaction.reply({
        content: '⚠️ Rating must be a whole number from 1 to 5.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const text = interaction.fields.getTextInputValue('text').trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const review = {
      orderId,
      rating,
      text,
      customerId: order.customerId,
      builderId: order.builderId,
      buildId: order.buildId,
      createdAt: new Date().toISOString(),
    };

    cache.getReviews().reviews.push(review);
    order.reviewed = true;

    const savedReviews = await storage.saveReviews(client);
    const savedOrders = await storage.saveOrders(client);
    if (!savedReviews || !savedOrders) {
      // Roll back to avoid a review that isn't persisted.
      cache.getReviews().reviews.pop();
      order.reviewed = false;
      return interaction.editReply('⚠️ Failed to save your review. Please try again.');
    }

    // Post to the reviews channel.
    const reviewsChannelId = cache.getConfig()?.channels?.reviews;
    if (reviewsChannelId) {
      const ch = await client.channels.fetch(reviewsChannelId).catch(() => null);
      if (ch && ch.isTextBased()) {
        await ch.send({ embeds: [embeds.reviewEmbed(review, order.customerId)] }).catch(() => {});
      }
    }

    await logAction(client, 'Review Submitted', `${order.displayId} — ${rating}★`);
    return interaction.editReply('⭐ Thank you for your review!');
  });
}

module.exports = { register };
