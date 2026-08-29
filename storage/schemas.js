'use strict';

/**
 * Schema defaults, validation and normalization for every BloxBuilt data
 * record. These functions guarantee that whatever we load from Discord (or
 * initialize fresh) has a predictable, complete shape — protecting the rest of
 * the codebase from malformed or partial records.
 *
 * Validation is deliberately lenient: it repairs/normalizes rather than
 * rejecting, EXCEPT it will never turn genuinely corrupt JSON into empty data
 * (parsing happens upstream in discordStorage — this layer only sees objects).
 */

function defaultConfig() {
  return {
    channels: {},
    roles: {},
    settings: {
      autoVerify: false,
    },
  };
}

function defaultBuilds() {
  return { builds: [] };
}

function defaultOrders() {
  return { orders: [] };
}

function defaultReviews() {
  return { reviews: [] };
}

function defaultState() {
  return {
    ordersOpen: true,
    nextOrderId: 1,
    nextSupportId: 1,
    queueMessageId: null,
    queueChannelId: null,
    orderPanelMessageId: null,
    orderPanelChannelId: null,
    lastSave: null,
    lastBackup: null,
  };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function normalizeConfig(raw) {
  const base = defaultConfig();
  if (!isObject(raw)) return base;
  return {
    channels: isObject(raw.channels) ? raw.channels : {},
    roles: isObject(raw.roles) ? raw.roles : {},
    settings: {
      autoVerify: Boolean(raw.settings?.autoVerify),
    },
  };
}

function normalizeBuild(raw) {
  if (!isObject(raw)) return null;
  if (!raw.id) return null;
  return {
    id: String(raw.id),
    name: raw.name != null ? String(raw.name) : 'Unnamed Build',
    style: raw.style != null ? String(raw.style) : '',
    cost: raw.cost != null ? String(raw.cost) : '',
    bedrooms: raw.bedrooms != null ? String(raw.bedrooms) : '',
    bathrooms: raw.bathrooms != null ? String(raw.bathrooms) : '',
    floors: raw.floors != null ? String(raw.floors) : '',
    gamepasses: raw.gamepasses != null ? String(raw.gamepasses) : '',
    description: raw.description != null ? String(raw.description) : '',
    imageUrl: raw.imageUrl != null ? String(raw.imageUrl) : '',
    active: raw.active !== false,
    listingChannelId: raw.listingChannelId ?? null,
    listingMessageId: raw.listingMessageId ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function normalizeBuilds(raw) {
  const arr = Array.isArray(raw?.builds) ? raw.builds : [];
  const builds = arr.map(normalizeBuild).filter(Boolean);
  return { builds };
}

function normalizeOrder(raw) {
  if (!isObject(raw)) return null;
  if (raw.orderId == null) return null;
  return {
    orderId: Number(raw.orderId),
    displayId: raw.displayId || `#${String(raw.orderId).padStart(4, '0')}`,
    customerId: raw.customerId != null ? String(raw.customerId) : '',
    robloxUsername: raw.robloxUsername != null ? String(raw.robloxUsername) : '',
    buildId: raw.buildId != null ? String(raw.buildId) : '',
    budget: raw.budget != null ? String(raw.budget) : '',
    gamepasses: raw.gamepasses != null ? String(raw.gamepasses) : '',
    availability: raw.availability != null ? String(raw.availability) : '',
    status: raw.status || 'WAITING',
    builderId: raw.builderId ?? null,
    acceptedBy: raw.acceptedBy ?? null,
    acceptedAt: raw.acceptedAt ?? null,
    channelId: raw.channelId ?? null,
    messageId: raw.messageId ?? null,
    reviewed: Boolean(raw.reviewed),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    completedAt: raw.completedAt ?? null,
    cancelledAt: raw.cancelledAt ?? null,
  };
}

function normalizeOrders(raw) {
  const arr = Array.isArray(raw?.orders) ? raw.orders : [];
  const orders = arr.map(normalizeOrder).filter(Boolean);
  return { orders };
}

function normalizeReview(raw) {
  if (!isObject(raw)) return null;
  if (raw.orderId == null) return null;
  return {
    orderId: Number(raw.orderId),
    rating: Math.min(5, Math.max(1, Number(raw.rating) || 0)),
    text: raw.text != null ? String(raw.text) : '',
    customerId: raw.customerId != null ? String(raw.customerId) : '',
    builderId: raw.builderId ?? null,
    buildId: raw.buildId != null ? String(raw.buildId) : '',
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function normalizeReviews(raw) {
  const arr = Array.isArray(raw?.reviews) ? raw.reviews : [];
  const reviews = arr.map(normalizeReview).filter(Boolean);
  return { reviews };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!isObject(raw)) return base;
  return {
    ordersOpen: raw.ordersOpen !== false,
    nextOrderId: Number.isInteger(raw.nextOrderId) && raw.nextOrderId > 0 ? raw.nextOrderId : 1,
    nextSupportId: Number.isInteger(raw.nextSupportId) && raw.nextSupportId > 0 ? raw.nextSupportId : 1,
    queueMessageId: raw.queueMessageId ?? null,
    queueChannelId: raw.queueChannelId ?? null,
    orderPanelMessageId: raw.orderPanelMessageId ?? null,
    orderPanelChannelId: raw.orderPanelChannelId ?? null,
    lastSave: raw.lastSave ?? null,
    lastBackup: raw.lastBackup ?? null,
  };
}

const normalizers = {
  config: normalizeConfig,
  builds: normalizeBuilds,
  orders: normalizeOrders,
  reviews: normalizeReviews,
  state: normalizeState,
};

const defaults = {
  config: defaultConfig,
  builds: defaultBuilds,
  orders: defaultOrders,
  reviews: defaultReviews,
  state: defaultState,
};

module.exports = {
  defaultConfig,
  defaultBuilds,
  defaultOrders,
  defaultReviews,
  defaultState,
  normalizeConfig,
  normalizeBuilds,
  normalizeOrders,
  normalizeReviews,
  normalizeState,
  normalizers,
  defaults,
};
