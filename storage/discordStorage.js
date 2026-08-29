'use strict';

/**
 * Discord-as-database storage engine for BloxBuilt.
 *
 * Design goals (per spec):
 *  - Discord is the single source of truth. No external DB, no permanent local
 *    files.
 *  - Each data record (config/builds/orders/reviews/state) is its own message
 *    in a private storage channel, carrying a JSON attachment. Records are
 *    identified by a stable marker in the message content so they can be
 *    rediscovered after any redeploy, even if locally-cached message IDs are
 *    gone.
 *  - Updates are atomic-style: build + validate the new payload BEFORE
 *    touching Discord, and never destroy a valid record if the write fails.
 *  - Corrupt JSON is never silently overwritten with empty data. Instead we
 *    keep the existing record, log loudly, and flag storage as needing
 *    attention.
 */

const {
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');

const cache = require('./cache');
const schemas = require('./schemas');
const { logger } = require('../utils/logger');
const {
  STORAGE_CATEGORY_NAME,
  STORAGE_CHANNEL_NAME,
  STORAGE_MARKERS,
  STORAGE_FILENAMES,
} = require('../utils/constants');

const RECORD_KEYS = ['config', 'builds', 'orders', 'reviews', 'state'];

// Tracks records that failed to load due to corruption so we don't clobber them.
const corruptRecords = new Set();

/**
 * Locate the private storage channel by name within the guild. Falls back to a
 * scan so it works regardless of any locally cached ID.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function findStorageChannel(guild) {
  // Ensure channel cache is fresh (survives redeploys with empty local cache).
  const channels = await guild.channels.fetch().catch(() => null);
  if (!channels) return null;

  const match = channels.find(
    (c) => c && c.type === ChannelType.GuildText && c.name === STORAGE_CHANNEL_NAME,
  );
  return match || null;
}

/**
 * Create the private category + storage channel, locking @everyone out and
 * granting the bot the permissions it needs.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextChannel>}
 */
async function createStorageChannel(guild) {
  const me = guild.members.me;
  const botId = me?.id ?? guild.client.user.id;

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  // Reuse an existing private category if present, otherwise create one.
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === STORAGE_CATEGORY_NAME,
  );
  if (!category) {
    category = await guild.channels.create({
      name: STORAGE_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites,
    });
  }

  const channel = await guild.channels.create({
    name: STORAGE_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: 'BloxBuilt persistent storage — do not edit. Managed automatically by the bot.',
    permissionOverwrites,
  });

  logger.info(`Created storage channel #${channel.name} (${channel.id})`);
  return channel;
}

/**
 * Read and JSON-parse the attachment on a storage message.
 * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
 */
async function readRecordFromMessage(message) {
  const attachment = message.attachments.first();
  if (!attachment) return { ok: false, error: 'no-attachment' };
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) return { ok: false, error: `http-${res.status}` };
    const text = await res.text();
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || 'parse-error' };
  }
}

/**
 * Scan the storage channel and map each record marker to its message.
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<Object<string, import('discord.js').Message>>}
 */
async function scanRecordMessages(channel) {
  const found = {};
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return found;

  // Newest first — keep the first match for each marker (latest valid).
  const sorted = [...messages.values()].sort(
    (a, b) => b.createdTimestamp - a.createdTimestamp,
  );

  for (const key of RECORD_KEYS) {
    const marker = STORAGE_MARKERS[key];
    const msg = sorted.find(
      (m) => m.author?.id === channel.client.user.id && m.content.includes(marker),
    );
    if (msg) found[key] = msg;
  }
  return found;
}

/**
 * Create a fresh record message with default (empty) data.
 */
async function createRecordMessage(channel, key) {
  const data = schemas.defaults[key]();
  const payload = buildAttachment(key, data);
  const msg = await channel.send({ content: STORAGE_MARKERS[key], files: [payload] });
  cache.setMessageId(key, msg.id);
  setCacheRecord(key, data);
  logger.info(`Initialized empty storage record: ${key}`);
  return msg;
}

function buildAttachment(key, data) {
  const json = JSON.stringify(data, null, 2);
  return new AttachmentBuilder(Buffer.from(json, 'utf8'), {
    name: STORAGE_FILENAMES[key],
  });
}

function setCacheRecord(key, data) {
  switch (key) {
    case 'config':
      cache.setConfig(data);
      break;
    case 'builds':
      cache.setBuilds(data);
      break;
    case 'orders':
      cache.setOrders(data);
      break;
    case 'reviews':
      cache.setReviews(data);
      break;
    case 'state':
      cache.setState(data);
      break;
    default:
      break;
  }
}

function getCacheRecord(key) {
  switch (key) {
    case 'config':
      return cache.getConfig();
    case 'builds':
      return cache.getBuilds();
    case 'orders':
      return cache.getOrders();
    case 'reviews':
      return cache.getReviews();
    case 'state':
      return cache.getState();
    default:
      return null;
  }
}

/**
 * Initialize the entire storage system. Called once on bot ready.
 *  1. Find (or create) the private storage channel.
 *  2. Scan for existing record messages.
 *  3. Load + normalize each record; create any that are missing.
 *  4. Populate the in-memory cache.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{ok:boolean, corrupt:string[]}>}
 */
async function initializeStorage(guild) {
  let channel = await findStorageChannel(guild);
  if (!channel) {
    logger.info('No storage channel found — creating one.');
    channel = await createStorageChannel(guild);
  }
  cache.setStorageChannelId(channel.id);

  const recordMessages = await scanRecordMessages(channel);

  for (const key of RECORD_KEYS) {
    const msg = recordMessages[key];
    if (!msg) {
      await createRecordMessage(channel, key);
      continue;
    }

    cache.setMessageId(key, msg.id);
    const result = await readRecordFromMessage(msg);

    if (!result.ok) {
      // Corrupt or unreadable: DO NOT overwrite. Keep the message, flag it,
      // and load safe defaults into memory ONLY for runtime (never persisted
      // over the corrupt record automatically).
      corruptRecords.add(key);
      logger.error(
        `Storage record "${key}" is corrupt/unreadable (${result.error}). ` +
          `Keeping existing message ${msg.id}; NOT overwriting. Loading defaults into memory only.`,
      );
      setCacheRecord(key, schemas.defaults[key]());
      continue;
    }

    const normalized = schemas.normalizers[key](result.data);
    setCacheRecord(key, normalized);
    logger.info(`Loaded storage record: ${key}`);
  }

  cache.setStorageReady(true);
  return { ok: true, corrupt: [...corruptRecords] };
}

/**
 * Persist a single record back to Discord using atomic-style semantics.
 *  1. Read current cache value for the record.
 *  2. Validate/normalize it.
 *  3. Build the JSON attachment.
 *  4. Edit the existing message (or send a new one) — the previous valid
 *     record is only replaced once the new upload succeeds.
 *  5. On failure: keep existing data, log, and surface the error to caller.
 *
 * @param {import('discord.js').Client} client
 * @param {string} key one of RECORD_KEYS
 * @returns {Promise<boolean>} success
 */
async function saveRecord(client, key) {
  if (!RECORD_KEYS.includes(key)) throw new Error(`Unknown storage record: ${key}`);

  // Refuse to overwrite a record we couldn't read (avoid clobbering corrupt
  // data with defaults). Callers that intentionally repair storage must clear
  // the corrupt flag first via markRepaired().
  if (corruptRecords.has(key)) {
    logger.error(
      `Refusing to save "${key}": record is flagged corrupt. Resolve/backup first.`,
    );
    return false;
  }

  const channelId = cache.getStorageChannelId();
  if (!channelId) {
    logger.error(`Cannot save "${key}": storage channel unknown.`);
    return false;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.error(`Cannot save "${key}": storage channel ${channelId} unavailable.`);
    return false;
  }

  // Validate/normalize before writing.
  const normalized = schemas.normalizers[key](getCacheRecord(key));
  setCacheRecord(key, normalized);

  let attachment;
  try {
    attachment = buildAttachment(key, normalized);
  } catch (err) {
    logger.error(`Failed to serialize "${key}" JSON:`, err?.message || err);
    return false;
  }

  const msgId = cache.getMessageId(key);
  try {
    if (msgId) {
      const existing = await channel.messages.fetch(msgId).catch(() => null);
      if (existing) {
        await existing.edit({ content: STORAGE_MARKERS[key], files: [attachment] });
      } else {
        // Message was deleted — recreate rather than lose the record.
        const created = await channel.send({
          content: STORAGE_MARKERS[key],
          files: [attachment],
        });
        cache.setMessageId(key, created.id);
      }
    } else {
      const created = await channel.send({
        content: STORAGE_MARKERS[key],
        files: [attachment],
      });
      cache.setMessageId(key, created.id);
    }
    return true;
  } catch (err) {
    logger.error(`Failed to persist "${key}" to Discord:`, err?.message || err);
    return false;
  }
}

// Named helpers used across the codebase. Each updates lastSave on state.
async function touchLastSave(client) {
  cache.getState().lastSave = new Date().toISOString();
}

const save = {
  saveConfig: async (client) => saveRecord(client, 'config'),
  saveBuilds: async (client) => saveRecord(client, 'builds'),
  saveOrders: async (client) => saveRecord(client, 'orders'),
  saveReviews: async (client) => saveRecord(client, 'reviews'),
  saveState: async (client) => saveRecord(client, 'state'),
};

/**
 * Save one record and stamp state.lastSave (also persisting state). Use this
 * for user-facing mutations so /storage status reflects recent activity.
 */
async function saveAndStamp(client, key) {
  const ok = await saveRecord(client, key);
  if (ok && key !== 'state') {
    cache.getState().lastSave = new Date().toISOString();
    await saveRecord(client, 'state');
  } else if (ok && key === 'state') {
    cache.getState().lastSave = new Date().toISOString();
    await saveRecord(client, 'state');
  }
  return ok;
}

function isCorrupt(key) {
  return corruptRecords.has(key);
}

function markRepaired(key) {
  corruptRecords.delete(key);
}

function corruptList() {
  return [...corruptRecords];
}

module.exports = {
  RECORD_KEYS,
  findStorageChannel,
  createStorageChannel,
  scanRecordMessages,
  readRecordFromMessage,
  initializeStorage,
  saveRecord,
  saveAndStamp,
  touchLastSave,
  isCorrupt,
  markRepaired,
  corruptList,
  ...save,
};
