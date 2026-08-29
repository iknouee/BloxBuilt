'use strict';

/**
 * Central branding, naming, status and identifier constants for BloxBuilt.
 * Nothing that varies per-server (channel IDs, role IDs) lives here — those
 * are configured at runtime through /config and stored in Discord storage.
 */

// Primary brand colour (blueprint blue) used across all embeds.
const BRAND_COLOR = 0x3b82f6;
const BRAND_NAME = 'BloxBuilt';

// Storage channel / category names created automatically on first startup.
const STORAGE_CATEGORY_NAME = '🔒 BLOXBUILT SYSTEM';
const STORAGE_CHANNEL_NAME = '🔒・bloxbuilt-data';

// Marker text used to identify each persistent data record message inside the
// private storage channel. The bot rediscovers records by scanning for these,
// so they must never change casually.
const STORAGE_MARKERS = {
  config: '⚙️ BLOXBUILT CONFIG',
  builds: '🏠 BLOXBUILT BUILDS',
  orders: '📋 BLOXBUILT ORDERS',
  reviews: '⭐ BLOXBUILT REVIEWS',
  state: '💾 BLOXBUILT STATE',
};

const STORAGE_FILENAMES = {
  config: 'config.json',
  builds: 'builds.json',
  orders: 'orders.json',
  reviews: 'reviews.json',
  state: 'state.json',
};

// Order status definitions. `key` is stored in data; label/emoji are for display.
const ORDER_STATUS = {
  WAITING: { key: 'WAITING', emoji: '🟡', label: 'Waiting' },
  ACCEPTED: { key: 'ACCEPTED', emoji: '🔵', label: 'Accepted' },
  BUILDING: { key: 'BUILDING', emoji: '🟣', label: 'Building' },
  WAITING_CUSTOMER: { key: 'WAITING_CUSTOMER', emoji: '🟠', label: 'Waiting for Customer' },
  COMPLETED: { key: 'COMPLETED', emoji: '🟢', label: 'Completed' },
  CANCELLED: { key: 'CANCELLED', emoji: '🔴', label: 'Cancelled' },
};

// Statuses that mean the order is no longer active (removed from queue).
const INACTIVE_STATUSES = [ORDER_STATUS.COMPLETED.key, ORDER_STATUS.CANCELLED.key];

// Support ticket statuses.
const SUPPORT_STATUS = {
  OPEN: { key: 'OPEN', emoji: '🟡', label: 'Open' },
  CLAIMED: { key: 'CLAIMED', emoji: '🔵', label: 'Claimed' },
  CLOSED: { key: 'CLOSED', emoji: '🔴', label: 'Closed' },
};

// Config keys for channels & roles. Used by /config selectors and views.
const CHANNEL_KEYS = ['welcome', 'orders', 'queue', 'builds', 'reviews', 'orderLogs', 'newOrders', 'announcements'];
const ROLE_KEYS = ['owner', 'management', 'builder', 'support', 'customer', 'member', 'verified'];

// Human-friendly labels for config view.
const CHANNEL_LABELS = {
  welcome: 'Welcome',
  orders: 'Orders',
  queue: 'Queue',
  builds: 'Builds',
  reviews: 'Reviews',
  orderLogs: 'Order Logs',
  newOrders: 'New Orders',
  announcements: 'Announcements',
};

const ROLE_LABELS = {
  owner: 'Owner',
  management: 'Management',
  builder: 'Builder',
  support: 'Support',
  customer: 'Customer',
  member: 'Member',
  verified: 'Verified',
};

// Emojis used sparingly across the UI.
const EMOJI = {
  house: '🏡',
  home: '🏠',
  build: '🏗️',
  hammer: '🔨',
  ticket: '🎫',
  star: '⭐',
  clipboard: '📋',
  money: '💰',
  bed: '🛏️',
  bath: '🚿',
  game: '🎮',
  lock: '🔒',
  green: '🟢',
  red: '🔴',
};

// Custom ID namespaces for persistent interaction components. Keeping these
// centralized avoids typos between the component builder and the router.
const IDS = {
  ORDER_CREATE: 'order:create',
  ORDER_SUPPORT: 'order:support',
  ORDER_MODAL: 'order:modal', // order:modal or order:modal:<buildId>
  SUPPORT_MODAL: 'support:modal',
  ORDER_ACCEPT: 'order:accept', // order:accept:<orderId>
  ORDER_ASSIGN: 'order:assign', // order:assign:<orderId>
  ORDER_ASSIGN_SELECT: 'order:assignselect', // order:assignselect:<orderId>
  ORDER_START: 'order:start',
  ORDER_WAIT: 'order:wait',
  ORDER_COMPLETE: 'order:complete',
  ORDER_CANCEL: 'order:cancel',
  ORDER_CLOSE: 'order:close',
  SUPPORT_CLAIM: 'support:claim', // support:claim:<supportId>
  SUPPORT_CLOSE: 'support:close', // support:close:<supportId>
  REVIEW_CREATE: 'review:create', // review:create:<orderId>
  REVIEW_MODAL: 'review:modal', // review:modal:<orderId>
  BUILD_ORDER: 'build:order', // build:order:<buildId>
  BUILD_REMOVE_CONFIRM: 'build:removeconfirm', // build:removeconfirm:<buildId>
  BUILD_REMOVE_CANCEL: 'build:removecancel', // build:removecancel:<buildId>
};

module.exports = {
  BRAND_COLOR,
  BRAND_NAME,
  STORAGE_CATEGORY_NAME,
  STORAGE_CHANNEL_NAME,
  STORAGE_MARKERS,
  STORAGE_FILENAMES,
  ORDER_STATUS,
  INACTIVE_STATUSES,
  SUPPORT_STATUS,
  CHANNEL_KEYS,
  ROLE_KEYS,
  CHANNEL_LABELS,
  ROLE_LABELS,
  EMOJI,
  IDS,
};
