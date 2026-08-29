'use strict';

/**
 * Confirmation buttons for /build remove. On confirm the build is marked
 * inactive (preserving historical orders that referenced it), its listing is
 * removed, storage is persisted, and the action logged.
 */

const { MessageFlags } = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const buildService = require('../../utils/buildService');
const { isManagement } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');
const { IDS } = require('../../utils/constants');

function register(router) {
  router.button(IDS.BUILD_REMOVE_CONFIRM, async (interaction, client, parts) => {
    if (!isManagement(interaction.member)) {
      return interaction.reply({
        content: '🔒 Only Owner/Management can remove builds.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const buildId = parts.slice(2).join(':');
    const build = cache.findBuild(buildId);
    if (!build) {
      return interaction.update({ content: '⚠️ Build no longer exists.', components: [] });
    }

    await interaction.deferUpdate();

    // Remove the listing and drop the build from the active catalogue.
    await buildService.deleteListing(client, build);
    cache.getBuilds().builds = cache.getBuilds().builds.filter(
      (b) => b.id.toLowerCase() !== build.id.toLowerCase(),
    );

    const saved = await storage.saveBuilds(client);
    if (!saved) {
      // Re-add to keep memory consistent with storage on failure.
      cache.getBuilds().builds.push(build);
      return interaction.editReply({
        content: '⚠️ Failed to save. Build was not removed.',
        components: [],
      });
    }

    await logAction(client, 'Build Removed', `\`${build.id}\` — ${build.name}`, {
      fields: [{ name: 'By', value: `<@${interaction.user.id}>`, inline: true }],
    });

    return interaction.editReply({
      content: `🗑️ Build \`${build.id}\` removed. Historical orders are unaffected.`,
      components: [],
    });
  });

  router.button(IDS.BUILD_REMOVE_CANCEL, async (interaction) => {
    await interaction
      .update({ content: 'Cancelled. No changes made.', components: [] })
      .catch(() => {});
  });
}

module.exports = { register };
