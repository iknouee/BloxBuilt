'use strict';

/**
 * Ticket transcript generation. Produces a self-contained HTML transcript
 * (preferred) capturing messages, authors, timestamps and attachment links.
 * If HTML generation fails for any reason it falls back to plain text so a
 * transcript is always produced.
 */

const { AttachmentBuilder } = require('discord.js');
const { logger } = require('./logger');

/**
 * Fetch up to `limit` messages from a channel, oldest-first.
 */
async function fetchAllMessages(channel, limit = 500) {
  const collected = [];
  let before;
  while (collected.length < limit) {
    const batch = await channel.messages
      .fetch({ limit: 100, before })
      .catch(() => null);
    if (!batch || batch.size === 0) break;
    const arr = [...batch.values()];
    collected.push(...arr);
    before = arr[arr.length - 1].id;
    if (batch.size < 100) break;
  }
  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(channelName, messages) {
  const rows = messages
    .map((m) => {
      const time = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
      const author = escapeHtml(`${m.author?.tag || m.author?.username || 'Unknown'}`);
      const content = m.content ? escapeHtml(m.content) : '';
      const attachments = [...m.attachments.values()]
        .map(
          (a) =>
            `<div class="att"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(a.name)}</a></div>`,
        )
        .join('');
      const embeds = (m.embeds || [])
        .map((e) => {
          const t = e.title ? `<b>${escapeHtml(e.title)}</b><br>` : '';
          const d = e.description ? `${escapeHtml(e.description)}` : '';
          if (!t && !d) return '';
          return `<div class="embed">${t}${d}</div>`;
        })
        .join('');
      return `
      <div class="msg">
        <div class="meta"><span class="author">${author}</span><span class="time">${time}</span></div>
        <div class="body">${content.replace(/\n/g, '<br>')}${embeds}${attachments}</div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Transcript — ${escapeHtml(channelName)}</title>
<style>
  body { background:#0f172a; color:#e2e8f0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; margin:0; padding:24px; }
  h1 { color:#3B82F6; font-size:20px; }
  .msg { border-bottom:1px solid #1e293b; padding:10px 0; }
  .meta { font-size:12px; margin-bottom:4px; }
  .author { color:#3B82F6; font-weight:600; margin-right:8px; }
  .time { color:#64748b; }
  .body { font-size:14px; line-height:1.5; white-space:normal; }
  .embed { border-left:3px solid #3B82F6; padding:6px 10px; margin:6px 0; background:#111827; border-radius:4px; }
  .att a { color:#60a5fa; text-decoration:none; }
</style>
</head>
<body>
  <h1>🏡 BloxBuilt Transcript — #${escapeHtml(channelName)}</h1>
  <p class="time">Generated ${new Date().toISOString()}</p>
  ${rows || '<p>No messages.</p>'}
</body>
</html>`;
}

function renderText(channelName, messages) {
  const header = `BloxBuilt Transcript — #${channelName}\nGenerated ${new Date().toISOString()}\n${'='.repeat(48)}\n`;
  const body = messages
    .map((m) => {
      const time = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
      const author = m.author?.tag || m.author?.username || 'Unknown';
      const atts = [...m.attachments.values()].map((a) => `[attachment: ${a.url}]`).join(' ');
      const embeds = (m.embeds || [])
        .map((e) => `[embed: ${e.title || ''} ${e.description || ''}]`.trim())
        .join(' ');
      return `[${time}] ${author}: ${m.content || ''} ${embeds} ${atts}`.trim();
    })
    .join('\n');
  return `${header}${body}\n`;
}

/**
 * Generate a transcript attachment for a channel.
 * @returns {Promise<{attachment: AttachmentBuilder, format: 'html'|'txt'}>}
 */
async function generateTranscript(channel) {
  const messages = await fetchAllMessages(channel).catch(() => []);
  try {
    const html = renderHtml(channel.name, messages);
    const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), {
      name: `transcript-${channel.name}.html`,
    });
    return { attachment, format: 'html' };
  } catch (err) {
    logger.warn('HTML transcript failed, falling back to text:', err?.message || err);
    const text = renderText(channel.name, messages);
    const attachment = new AttachmentBuilder(Buffer.from(text, 'utf8'), {
      name: `transcript-${channel.name}.txt`,
    });
    return { attachment, format: 'txt' };
  }
}

module.exports = { generateTranscript, fetchAllMessages };
