'use strict';

/**
 * Support ticket buttons: Claim + Close. Support-level staff can operate these.
 * Support tickets are not tracked in the build queue and are not persisted as
 * orders — closing simply generates a transcript and removes the channel.
 */

const { MessageFlags } = require('discord.js');
const ticketService = require('../../utils/ticketService');
const embeds = require('../../utils/embeds');
const { isSupport } = require('../../utils/permissions');
const { SUPPORT_STATUS, IDS } = require('../../utils/constants');

function register(router) {
  // Claim
  router.button(IDS.SUPPORT_CLAIM, async (interaction, client, parts) => {
    if (!isSupport(interaction.member)) {
      return interaction.reply({
        content: '🔒 Only support staff can claim tickets.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const supportId = parts[parts.length - 1];

    // Update the ticket embed to reflect the claim.
    const message = interaction.message;
    const original = message.embeds[0];
    const embed = embeds.base().setTitle(original?.title || `🎫 BloxBuilt Support #${supportId}`);
    if (original?.fields) {
      embed.addFields(
        original.fields.map((f) =>
          f.name === 'Status'
            ? { name: 'Status', value: `${SUPPORT_STATUS.CLAIMED.emoji} ${SUPPORT_STATUS.CLAIMED.label} — <@${interaction.user.id}>`, inline: f.inline }
            : { name: f.name, value: f.value, inline: f.inline },
        ),
      );
    }
    embed.setTimestamp();

    await interaction.update({ embeds: [embed] }).catch(() => {});
    await interaction.followUp({
      content: `🙋 <@${interaction.user.id}> claimed this ticket.`,
    }).catch(() => {});
  });

  // Close
  router.button(IDS.SUPPORT_CLOSE, async (interaction, client) => {
    if (!isSupport(interaction.member)) {
      return interaction.reply({
        content: '🔒 Only support staff can close tickets.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const channel = interaction.channel;
    await interaction.reply({
      content: '🔒 Closing this support ticket. A transcript will be saved.',
      flags: MessageFlags.Ephemeral,
    });
    await ticketService.closeTicket(client, channel, { closedBy: interaction.user.id });
  });
}

module.exports = { register };
