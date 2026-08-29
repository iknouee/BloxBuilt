'use strict';

/**
 * Handles the support-topic modal submission. Support tickets are independent
 * of the build queue and can be opened even while build orders are closed.
 * Support IDs are sequential and stored in state.nextSupportId.
 */

const { MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const ticketService = require('../../utils/ticketService');
const { logAction, logger } = require('../../utils/logger');
const { IDS } = require('../../utils/constants');

function register(router) {
  router.modal(IDS.SUPPORT_MODAL, async (interaction, client) => {
    const topic = interaction.fields.getTextInputValue('topic').trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const state = cache.getState();
    const supportId = state.nextSupportId;

    let ticket;
    try {
      ticket = await ticketService.createSupportTicket(
        interaction.guild,
        supportId,
        interaction.user.id,
        topic,
      );
    } catch (err) {
      logger.error('Failed to create support ticket:', err?.message || err);
      return interaction.editReply(
        '⚠️ I could not create your support ticket. Please contact staff.',
      );
    }

    state.nextSupportId = supportId + 1;
    await storage.saveState(client);

    await logAction(
      client,
      'Support Ticket Opened',
      `#${String(supportId).padStart(4, '0')} by <@${interaction.user.id}> → ${ticket.channel}`,
    );

    return interaction.editReply(`✅ Support ticket created: ${ticket.channel}`);
  });
}

module.exports = { register };
