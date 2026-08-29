'use strict';

/**
 * Role-based permission helpers built on the configured roles (never
 * hard-coded IDs). All checks read the live config from cache.
 *
 * Hierarchy (highest first): owner > management > builder/support.
 * Owners implicitly pass every check; management passes builder/support-level
 * checks too, since they can do anything staff can.
 */

const cache = require('./../storage/cache');

/**
 * @param {import('discord.js').GuildMember} member
 * @param {string} roleKey config role key (owner/management/builder/...)
 */
function hasRole(member, roleKey) {
  if (!member) return false;
  const roleId = cache.getConfig()?.roles?.[roleKey];
  if (!roleId) return false;
  return member.roles.cache.has(roleId);
}

// Server administrators / the guild owner always count as Owner-level so the
// bot is usable before roles are configured.
function isServerAdmin(member) {
  if (!member) return false;
  return (
    member.permissions?.has?.('Administrator') === true ||
    member.guild?.ownerId === member.id
  );
}

function isOwner(member) {
  return isServerAdmin(member) || hasRole(member, 'owner');
}

function isManagement(member) {
  return isOwner(member) || hasRole(member, 'management');
}

function isBuilder(member) {
  return isManagement(member) || hasRole(member, 'builder');
}

function isSupport(member) {
  return isManagement(member) || hasRole(member, 'support');
}

// Staff = anyone with a staff role (builder/support/management/owner).
function isStaff(member) {
  return isBuilder(member) || isSupport(member);
}

module.exports = {
  hasRole,
  isServerAdmin,
  isOwner,
  isManagement,
  isBuilder,
  isSupport,
  isStaff,
};
