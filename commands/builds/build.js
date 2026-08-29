'use strict';

/**
 * /build add|edit|remove|view|list — manage available builds.
 *
 * Builds have 10 attributes (more than a Discord modal's 5-input limit), so
 * add/edit use slash-command options directly. Every mutation persists to
 * Discord storage and updates the live listing message. Historical orders that
 * reference a Build ID are never modified when a build is edited or removed.
 *
 * add/edit/remove: Owner / Management.  view/list: anyone.
 */

const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const cache = require('../../storage/cache');
const storage = require('../../storage/discordStorage');
const buildService = require('../../utils/buildService');
const embeds = require('../../utils/embeds');
const { isManagement } = require('../../utils/permissions');
const { logAction } = require('../../utils/logger');
const { IDS } = require('../../utils/constants');

const data = new SlashCommandBuilder()
  .setName('build')
  .setDescription('Manage BloxBuilt available builds')
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Add a new build (management only)')
      .addStringOption((o) => o.setName('id').setDescription('Build ID, e.g. BB-001').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('Build name').setRequired(true))
      .addStringOption((o) => o.setName('cost').setDescription('Build cost, e.g. $185,000').setRequired(true))
      .addStringOption((o) => o.setName('style').setDescription('Style, e.g. Modern').setRequired(false))
      .addStringOption((o) => o.setName('bedrooms').setDescription('Bedrooms').setRequired(false))
      .addStringOption((o) => o.setName('bathrooms').setDescription('Bathrooms').setRequired(false))
      .addStringOption((o) => o.setName('floors').setDescription('Floors').setRequired(false))
      .addStringOption((o) => o.setName('gamepasses').setDescription('Required gamepasses').setRequired(false))
      .addStringOption((o) => o.setName('description').setDescription('Description').setRequired(false))
      .addStringOption((o) => o.setName('image').setDescription('Image URL').setRequired(false)),
  )
  .addSubcommand((s) =>
    s
      .setName('edit')
      .setDescription('Edit an existing build (management only)')
      .addStringOption((o) =>
        o.setName('id').setDescription('Build ID to edit').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((o) => o.setName('name').setDescription('Build name').setRequired(false))
      .addStringOption((o) => o.setName('cost').setDescription('Build cost').setRequired(false))
      .addStringOption((o) => o.setName('style').setDescription('Style').setRequired(false))
      .addStringOption((o) => o.setName('bedrooms').setDescription('Bedrooms').setRequired(false))
      .addStringOption((o) => o.setName('bathrooms').setDescription('Bathrooms').setRequired(false))
      .addStringOption((o) => o.setName('floors').setDescription('Floors').setRequired(false))
      .addStringOption((o) => o.setName('gamepasses').setDescription('Required gamepasses').setRequired(false))
      .addStringOption((o) => o.setName('description').setDescription('Description').setRequired(false))
      .addStringOption((o) => o.setName('image').setDescription('Image URL').setRequired(false)),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Remove a build (management only)')
      .addStringOption((o) =>
        o.setName('id').setDescription('Build ID to remove').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('view')
      .setDescription('View a build')
      .addStringOption((o) =>
        o.setName('id').setDescription('Build ID').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((s) => s.setName('list').setDescription('List all builds'));

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = cache
    .getBuilds()
    .builds.filter((b) => b.id.toLowerCase().includes(focused) || b.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((b) => ({ name: `${b.id} — ${b.name}`.slice(0, 100), value: b.id }));
  await interaction.respond(choices).catch(() => {});
}

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') return handleList(interaction);
  if (sub === 'view') return handleView(interaction);

  // Remaining subcommands are management-only.
  if (!isManagement(interaction.member)) {
    return interaction.reply({
      content: '🔒 Only Owner/Management can manage builds.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'add') return handleAdd(interaction, client);
  if (sub === 'edit') return handleEdit(interaction, client);
  if (sub === 'remove') return handleRemove(interaction, client);

  return interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
}

async function handleAdd(interaction, client) {
  const id = interaction.options.getString('id').trim();
  if (cache.findBuild(id)) {
    return interaction.reply({
      content: `⚠️ A build with ID \`${id}\` already exists. Use \`/build edit\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const build = {
    id,
    name: interaction.options.getString('name'),
    cost: interaction.options.getString('cost'),
    style: interaction.options.getString('style') || '',
    bedrooms: interaction.options.getString('bedrooms') || '',
    bathrooms: interaction.options.getString('bathrooms') || '',
    floors: interaction.options.getString('floors') || '',
    gamepasses: interaction.options.getString('gamepasses') || '',
    description: interaction.options.getString('description') || '',
    imageUrl: interaction.options.getString('image') || '',
    active: true,
    listingChannelId: null,
    listingMessageId: null,
    createdAt: new Date().toISOString(),
  };

  cache.getBuilds().builds.push(build);

  const listing = await buildService.postListing(client, build);
  const saved = await storage.saveBuilds(client);
  if (!saved) {
    // Roll back memory to avoid divergence from storage.
    cache.getBuilds().builds.pop();
    return interaction.editReply('⚠️ Failed to save build to storage. Build was not added.');
  }

  await logAction(client, 'Build Added', `\`${build.id}\` — ${build.name}`, {
    fields: [{ name: 'By', value: `<@${interaction.user.id}>`, inline: true }],
  });

  const note = listing.ok ? '' : `\n⚠️ Listing not posted: ${listing.error}`;
  return interaction.editReply(`✅ Build \`${build.id}\` added.${note}`);
}

async function handleEdit(interaction, client) {
  const id = interaction.options.getString('id').trim();
  const build = cache.findBuild(id);
  if (!build) {
    return interaction.reply({
      content: `⚠️ No build found with ID \`${id}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const fields = ['name', 'cost', 'style', 'bedrooms', 'bathrooms', 'floors', 'gamepasses', 'description'];
  for (const f of fields) {
    const val = interaction.options.getString(f);
    if (val != null) build[f] = val;
  }
  const image = interaction.options.getString('image');
  if (image != null) build.imageUrl = image;

  const saved = await storage.saveBuilds(client);
  if (!saved) {
    return interaction.editReply('⚠️ Failed to save changes to storage.');
  }

  await buildService.updateListing(client, build);
  await logAction(client, 'Build Edited', `\`${build.id}\` — ${build.name}`, {
    fields: [{ name: 'By', value: `<@${interaction.user.id}>`, inline: true }],
  });

  return interaction.editReply(`✅ Build \`${build.id}\` updated.`);
}

async function handleRemove(interaction) {
  const id = interaction.options.getString('id').trim();
  const build = cache.findBuild(id);
  if (!build) {
    return interaction.reply({
      content: `⚠️ No build found with ID \`${id}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.BUILD_REMOVE_CONFIRM}:${build.id}`)
      .setLabel('Remove Build')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${IDS.BUILD_REMOVE_CANCEL}:${build.id}`)
      .setLabel('Cancel')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
  );

  return interaction.reply({
    content: `Are you sure you want to remove build \`${build.id}\` — **${build.name}**?\nHistorical orders will be kept.`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleView(interaction) {
  const id = interaction.options.getString('id').trim();
  const build = cache.findBuild(id);
  if (!build) {
    return interaction.reply({
      content: `⚠️ No build found with ID \`${id}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }
  return interaction.reply({
    embeds: [embeds.buildListingEmbed(build)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleList(interaction) {
  const builds = cache.getBuilds().builds;
  if (!builds.length) {
    return interaction.reply({ content: 'No builds have been added yet.', flags: MessageFlags.Ephemeral });
  }

  const lines = builds
    .slice(0, 40)
    .map(
      (b) =>
        `\`${b.id}\` • **${b.name}** • ${b.cost || '—'} • ${b.active ? '🟢 Active' : '⚪ Inactive'}`,
    )
    .join('\n');

  const embed = embeds
    .base()
    .setTitle('🏠 BloxBuilt Builds')
    .setDescription(lines)
    .setFooter({ text: `${builds.length} build(s)` });

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute, autocomplete };
