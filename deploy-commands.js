'use strict';

/**
 * Registers BloxBuilt slash commands to a single guild (GUILD_ID) for instant
 * availability. Run manually with `npm run deploy` — the bot does NOT redeploy
 * commands on every startup.
 *
 * Uses the same command files the bot loads, so there is a single source of
 * truth for command definitions.
 */

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { logger } = require('./utils/logger');

const REQUIRED = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

async function main() {
  const commands = loadCommands(null);
  const body = [...commands.values()].map((c) => c.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  logger.info(`Registering ${body.length} slash command(s) to guild ${process.env.GUILD_ID}...`);
  const result = await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body },
  );
  logger.info(`Successfully registered ${result.length} command(s).`);
}

main().catch((err) => {
  logger.error('Command deployment failed:', err?.message || err);
  process.exit(1);
});
