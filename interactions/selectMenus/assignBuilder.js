'use strict';

/**
 * Handles the builder user-select menu shown by the "Assign Builder" button.
 * Validates that the chosen user actually has the configured Builder role
 * before assigning, then persists + refreshes + mentions the builder.
 */

const { MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const orderService = require('../../utils/orderService');
const { isManagement } = require('../../utils/permissions');
const { IDS } = require('../../utils/constants');

function register(router) {
  router.select(IDS.ORDER_ASSIGN_SELECT, async (interaction, client, parts) => {
    if (!isManagement(interaction.member)) {
      return interaction.reply({
        content: '🔒 Only Management can assign builders.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const orderId = Number(parts[parts.length - 1]);
    const order = cache.findOrder(orderId);
    if (!order) {
      return interaction.reply({
        content: '⚠️ Order not found.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const chosenId = interaction.values[0];
    const builderRoleId = cache.getConfig()?.roles?.builder;

    // Verify the selected member has the Builder role (eligibility check).
    const member = await interaction.guild.members.fetch(chosenId).catch(() => null);
    if (builderRoleId && (!member || !member.roles.cache.has(builderRoleId))) {
      return interaction.reply({
        content: '⚠️ That user does not have the Builder role and cannot be assigned.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate();
    const ok = await orderService.assignBuilder(client, order, chosenId, interaction.user.id);

    // Mention the builder in the ticket.
    if (ok && order.channelId) {
      const ch = await client.channels.fetch(order.channelId).catch(() => null);
      if (ch && ch.isTextBased()) {
        await ch.send({ content: `👤 <@${chosenId}> has been assigned to this order.` }).catch(() => {});
      }
    }

    await interaction
      .editReply({
        content: ok
          ? `✅ Assigned <@${chosenId}> to order ${order.displayId}.`
          : '⚠️ Failed to persist assignment.',
        components: [],
      })
      .catch(() => {});
  });
}

module.exports = { register };
