'use strict';

/**
 * Loads event modules from /events and binds them to the client. Each event
 * module exports { name, once?, execute(...args, client) }.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(eventsDir)) return;

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'));
  let count = 0;
  for (const file of files) {
    try {
      const event = require(path.join(eventsDir, file));
      if (!event?.name || typeof event.execute !== 'function') {
        logger.warn(`Skipping invalid event file: ${file}`);
        continue;
      }
      const handler = (...args) => event.execute(...args, client);
      if (event.once) client.once(event.name, handler);
      else client.on(event.name, handler);
      count += 1;
    } catch (err) {
      logger.error(`Failed to load event ${file}:`, err?.message || err);
    }
  }
  logger.info(`Loaded ${count} event(s).`);
}

module.exports = { loadEvents };
