'use strict';

/**
 * interactionCreate — the single funnel for every interaction.
 *
 *  - Slash commands dispatch to client.commands.
 *  - Buttons / modals / select menus dispatch to the persistent interaction
 *    router (no collectors, so everything works after a restart).
 */

const { Events, MessageFlags } = require('discord.js');
const { route } = require('../handlers/interactionRouter');
const { logger } = require('../utils/logger');

async function safeReplyError(interaction, message) {
  const payload = { content: message, flags: MessageFlags.Ephemeral };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (_) {
    /* interaction expired */
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        await safeReplyError(interaction, 'Unknown command.');
        return;
      }
      try {
        await command.execute(interaction, client);
      } catch (err) {
        logger.error(
          `Command "${interaction.commandName}" failed:`,
          err?.stack || err?.message || err,
        );
        await safeReplyError(interaction, 'Something went wrong running that command.');
      }
      return;
    }

    // Autocomplete
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === 'function') {
        try {
          await command.autocomplete(interaction, client);
        } catch (err) {
          logger.warn(`Autocomplete failed for ${interaction.commandName}:`, err?.message || err);
        }
      }
      return;
    }

    // Components + modals
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
      await route(interaction, client);
    }
  },
};
