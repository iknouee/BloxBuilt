'use strict';

/**
 * In-memory cache of all BloxBuilt data for fast access while running.
 *
 * The cache is populated once at startup from Discord storage, then kept in
 * sync: every mutation updates the cache first and then persists the relevant
 * record back to Discord (Discord remains the source of truth).
 *
 * This module holds *only* state. Persistence lives in discordStorage.js to
 * avoid circular dependencies (discordStorage writes into this cache on load).
 */

const schemas = require('./schemas');

const cache = {
  config: schemas.defaultConfig(),
  builds: schemas.defaultBuilds(),
  orders: schemas.defaultOrders(),
  reviews: schemas.defaultReviews(),
  state: schemas.defaultState(),
  // Message IDs of each storage record inside the private channel.
  messageIds: {
    config: null,
    builds: null,
    orders: null,
    reviews: null,
    state: null,
  },
  storageChannelId: null,
  storageReady: false,
};

module.exports = {
  // ---- Raw record access ----
  getConfig: () => cache.config,
  getBuilds: () => cache.builds,
  getOrders: () => cache.orders,
  getReviews: () => cache.reviews,
  getState: () => cache.state,

  setConfig: (v) => {
    cache.config = v;
  },
  setBuilds: (v) => {
    cache.builds = v;
  },
  setOrders: (v) => {
    cache.orders = v;
  },
  setReviews: (v) => {
    cache.reviews = v;
  },
  setState: (v) => {
    cache.state = v;
  },

  // ---- Storage bookkeeping ----
  getMessageId: (key) => cache.messageIds[key],
  setMessageId: (key, id) => {
    cache.messageIds[key] = id;
  },
  getStorageChannelId: () => cache.storageChannelId,
  setStorageChannelId: (id) => {
    cache.storageChannelId = id;
  },
  isStorageReady: () => cache.storageReady,
  setStorageReady: (v) => {
    cache.storageReady = Boolean(v);
  },

  // ---- Convenience helpers ----
  findBuild: (buildId) =>
    cache.builds.builds.find((b) => b.id.toLowerCase() === String(buildId).toLowerCase()),
  findActiveBuild: (buildId) =>
    cache.builds.builds.find(
      (b) => b.active && b.id.toLowerCase() === String(buildId).toLowerCase(),
    ),
  findOrder: (orderId) => cache.orders.orders.find((o) => o.orderId === Number(orderId)),
  findActiveOrderByCustomer: (customerId) =>
    cache.orders.orders.find(
      (o) =>
        o.customerId === String(customerId) &&
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELLED',
    ),
  findReview: (orderId) => cache.reviews.reviews.find((r) => r.orderId === Number(orderId)),
  activeOrders: () =>
    cache.orders.orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'),

  _raw: cache,
};
