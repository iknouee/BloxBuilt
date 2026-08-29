'use strict';

/**
 * Recursively loads slash command modules from /commands into a Collection.
 * Each command module must export { data, execute } where `data` is a
 * SlashCommandBuilder and `execute(interaction, client)` runs it.
 */

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const { logger } = require('../utils/logger');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

/**
 * @param {import('discord.js').Client} client
 * @returns {Collection<string, object>} loaded commands
 */
function loadCommands(client) {
  const commands = new Collection();
  const commandsDir = path.join(__dirname, '..', 'commands');
  if (!fs.existsSync(commandsDir)) return commands;

  for (const file of walk(commandsDir)) {
    try {
      // Clear from require cache so reloads pick up changes in dev.
      delete require.cache[require.resolve(file)];
      const command = require(file);
      if (!command?.data?.name || typeof command.execute !== 'function') {
        logger.warn(`Skipping invalid command file: ${file}`);
        continue;
      }
      commands.set(command.data.name, command);
    } catch (err) {
      logger.error(`Failed to load command ${file}:`, err?.message || err);
    }
  }

  if (client) client.commands = commands;
  logger.info(`Loaded ${commands.size} slash command(s).`);
  return commands;
}

module.exports = { loadCommands, walk };
