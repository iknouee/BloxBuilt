/**
 * Posts a new-build announcement to a Discord channel via the bot token.
 *
 * This talks to Discord's REST API directly (no gateway/websocket), so it runs
 * fine in a serverless API route. It is best-effort: a Discord failure must
 * never block the build from being saved.
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN   — a bot token with access to the channel
 *   DISCORD_BUILDS_CHANNEL_ID — the channel to post builds into
 * Optional:
 *   NEXT_PUBLIC_SITE_URL — used to link back to the site
 */

import type { Build } from './types';
import { formatCash, formatBlockbux } from './format';

const BRAND_COLOR = 0x3b82f6;

export function isDiscordConfigured(): boolean {
  return Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BUILDS_CHANNEL_ID);
}

/**
 * Send a build embed to the configured Discord channel.
 * Returns true on success; never throws.
 */
export async function postBuildToDiscord(build: Build): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_BUILDS_CHANNEL_ID;
  if (!token || !channelId) return false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Build ID', value: `\`${build.id}\``, inline: true },
    { name: '💰 Cash Price', value: formatCash(build.cashPrice), inline: true },
    { name: 'Blockbux', value: formatBlockbux(build.blockbux), inline: true },
  ];
  if (build.category) fields.push({ name: '🏗️ Category', value: build.category, inline: true });
  if (build.gamepasses.length) {
    fields.push({
      name: '🎮 Required Gamepasses',
      value: build.gamepasses.join(', ').slice(0, 1000),
      inline: false,
    });
  }

  const embed: Record<string, unknown> = {
    title: `🏡 ${build.name}`,
    color: BRAND_COLOR,
    description: (build.description || 'A new build is available!').slice(0, 2000),
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'BloxBuilt · New build available' },
  };
  if (build.images[0]) embed.image = { url: build.images[0] };
  if (siteUrl) embed.url = siteUrl;

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: siteUrl ? `New build added — browse it at ${siteUrl}` : 'New build added!',
        embeds: [embed],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
