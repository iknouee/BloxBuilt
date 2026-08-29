'use strict';

/**
 * /sendhowitworks — post the "How BloxBuilt Works" info embed to a channel.
 * Owner / Management only.
 */

const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const embeds = require('../../utils/embeds');
const { isManagement } = require('../../utils/permissions');

const data = new SlashCommandBuilder()
  .setName('sendhowitworks')
  .setDescription('Post the "How It Works" embed (management only)')
  .addChannelOption((o) =>
    o
      .setName('channel')
      .setDescription('Channel to post in (defaults to this channel)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false),
  );

async function execute(interaction) {
  if (!isManagement(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only Owner/Management can use this.',
      flags: MessageFlags.Ephemeral,
    });
  }
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  await channel.send({ embeds: [embeds.howItWorksEmbed()] });
  return interaction.reply({
    content: `✅ Posted How It Works to ${channel}.`,
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { data, execute };
