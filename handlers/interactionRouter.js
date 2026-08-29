'use strict';

/**
 * Central router for component + modal interactions.
 *
 * Persistent components (order panel buttons, ticket buttons, build "Order
 * This Build" buttons, review buttons, etc.) survive restarts because they are
 * matched purely by their custom ID here — there are NO temporary collectors
 * anywhere in BloxBuilt.
 *
 * Custom IDs use the form `namespace:action[:arg]`. Handlers register against a
 * prefix and receive the parsed argument segments.
 */

const { MessageFlags } = require('discord.js');
const { logger } = require('../utils/logger');

// Each entry: { match(customId): boolean, handle(interaction, client, parts) }
const buttonHandlers = [];
const modalHandlers = [];
const selectHandlers = [];

function register(list, prefix, handle) {
  list.push({
    prefix,
    handle,
  });
}

const router = {
  button: (prefix, handle) => register(buttonHandlers, prefix, handle),
  modal: (prefix, handle) => register(modalHandlers, prefix, handle),
  select: (prefix, handle) => register(selectHandlers, prefix, handle),
};

/**
 * Load all handler registrations from /interactions.
 */
function loadInteractions() {
  const fs = require('fs');
  const path = require('path');
  const base = path.join(__dirname, '..', 'interactions');
  const subdirs = ['buttons', 'modals', 'selectMenus'];
  for (const sub of subdirs) {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      try {
        const mod = require(path.join(dir, file));
        if (typeof mod.register === 'function') mod.register(router);
      } catch (err) {
        logger.error(`Failed to load interaction module ${file}:`, err?.message || err);
      }
    }
  }
  logger.info(
    `Loaded interaction handlers: ${buttonHandlers.length} button, ${modalHandlers.length} modal, ${selectHandlers.length} select.`,
  );
}

function findHandler(list, customId) {
  // Longest-prefix match wins so `order:assignselect` beats `order:assign`.
  let best = null;
  for (const entry of list) {
    if (customId === entry.prefix || customId.startsWith(`${entry.prefix}:`)) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry;
    }
  }
  return best;
}

async function safeReplyError(interaction, message) {
  const payload = { content: message, flags: MessageFlags.Ephemeral };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (_) {
    // Interaction already gone / expired — nothing else we can do.
  }
}

/**
 * Route a component or modal interaction to its handler.
 */
async function route(interaction, client) {
  let list;
  if (interaction.isButton()) list = buttonHandlers;
  else if (interaction.isModalSubmit()) list = modalHandlers;
  else if (interaction.isAnySelectMenu()) list = selectHandlers;
  else return false;

  const customId = interaction.customId;
  const entry = findHandler(list, customId);
  if (!entry) {
    logger.warn(`No handler for interaction: ${customId}`);
    await safeReplyError(interaction, 'This action is no longer available.');
    return true;
  }

  const parts = customId.split(':'); // [namespace, action, ...args]
  try {
    await entry.handle(interaction, client, parts);
  } catch (err) {
    logger.error(`Interaction handler error for ${customId}:`, err?.stack || err?.message || err);
    await safeReplyError(interaction, 'Something went wrong handling that action.');
  }
  return true;
}

module.exports = { router, loadInteractions, route, safeReplyError };
