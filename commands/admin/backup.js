'use strict';

/**
 * /backup — create a full JSON backup of all BloxBuilt data and upload it to
 * the private storage channel. Owner only. Ephemeral response.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { backupData } = require('../../storage/backup');
const storage = require('../../storage/discordStorage');
const { isOwner } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');

const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Create a full data backup (owner only)');

async function execute(interaction, client) {
  if (!isOwner(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only the Owner can create backups.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await backupData(client);
  if (!result.ok) {
    return interaction.editReply(`⚠️ Backup failed: ${result.error}`);
  }

  // Persist state so lastBackup timestamp survives restarts.
  await storage.saveState(client);
  await logAction(client, 'Backup Created', `\`${result.filename}\` by <@${interaction.user.id}>.`);

  return interaction.editReply(`💾 Backup created and stored: \`${result.filename}\``);
}

module.exports = { data, execute };
