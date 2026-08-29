'use strict';

/**
 * BloxBuilt entry point.
 *
 * Responsibilities are intentionally thin:
 *   - start the Express web service (Render health checks)
 *   - create + configure the Discord client
 *   - load command / event / interaction handlers
 *   - connect to Discord
 *
 * Storage initialization and data loading happen in the `ready` event once the
 * client is connected and the guild is available.
 */

require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { loadInteractions } = require('./handlers/interactionRouter');
const cache = require('./storage/cache');
const { logger } = require('./utils/logger');

const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);
loadInteractions();

// ---------------------------------------------------------------------------
// Express web service (Render)
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.status(200).send('🏡 BloxBuilt is online');
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    discord: client.isReady() ? 'connected' : 'connecting',
    storage: cache.isStorageReady() ? 'connected' : 'initializing',
    uptime: Math.floor(process.uptime()),
  });
});

app.listen(PORT, () => logger.info(`Express listening on port ${PORT}`));

// ---------------------------------------------------------------------------
// Global safety nets — one failed action must never crash the whole bot.
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err?.stack || err);
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  logger.error('Failed to log in to Discord:', err?.message || err);
  process.exit(1);
});

module.exports = { client, app };
