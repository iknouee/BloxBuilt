# 🏡 BloxBuilt

A production-ready Discord bot for **BloxBuilt**, a Bloxburg house building service. Customers browse available builds, pick a Build ID, open an order ticket, and the team builds their house.

**No external database.** BloxBuilt uses a **private Discord channel as its persistent data store** — configuration, builds, orders, reviews and state all live inside Discord, so a full Render redeploy never loses data.

---

## ✨ Features

- Available builds catalogue with per-build **Order This Build** buttons
- Full order lifecycle with private tickets and persistent status buttons
- Build queue (one self-updating message)
- Staff assignment via a Builder-filtered select menu
- Order statuses: 🟡 Waiting · 🔵 Accepted · 🟣 Building · 🟠 Waiting for Customer · 🟢 Completed · 🔴 Cancelled
- Reviews (1–5 ★) with duplicate prevention
- HTML/text ticket transcripts sent to your logs channel
- Welcome messages + optional auto-verify
- `/config` for channels & roles (Discord selectors — no typing IDs)
- Backups + storage status tooling
- Express web service with `/` and `/health` for Render

---

## 🧱 Tech Stack

Node.js · discord.js v14 · Express · npm · GitHub · Render. **No Supabase / PostgreSQL / MongoDB / MySQL / SQLite.**

---

## 📁 Project Structure

```
BloxBuilt/
├── commands/
│   ├── admin/        config, orders, backup, storage, sendorderpanel, sendqueue
│   ├── builds/       build (add/edit/remove/view/list)
│   └── orders/       order (lookup/assign/status/close)
├── events/           ready, interactionCreate, guildMemberAdd
├── interactions/
│   ├── buttons/      orderPanel, orderTicket, supportTicket, review, buildRemove
│   ├── modals/       orderModal, supportModal, reviewModal
│   └── selectMenus/  assignBuilder
├── handlers/         commandHandler, eventHandler, interactionRouter
├── storage/          discordStorage, cache, schemas, backup
├── utils/            constants, logger, embeds, permissions, transcripts,
│                     orderService, ticketService, buildService
├── index.js
├── deploy-commands.js
├── package.json
├── render.yaml
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔑 Environment Variables

Only four — **no database variables**:

| Variable        | Description                                   |
| --------------- | --------------------------------------------- |
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal   |
| `CLIENT_ID`     | Application (client) ID                        |
| `GUILD_ID`      | Your BloxBuilt server ID                       |
| `PORT`          | Web port (Render sets this; defaults to 3000)  |

Copy `.env.example` → `.env` for local development. **Never commit `.env`.**

---

## 🤖 Discord Developer Portal Setup

1. Create an application at <https://discord.com/developers/applications>.
2. **Bot** tab → add a bot, copy the **token** → `DISCORD_TOKEN`.
3. **General Information** → copy **Application ID** → `CLIENT_ID`.
4. **Bot → Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent** (welcome + role checks)
   - ✅ **Message Content Intent** (transcripts)
5. Invite the bot with an OAuth2 URL using scopes `bot applications.commands`.

### Required Intents (already set in code)
`Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`.

### Required Bot Permissions
- Manage Channels (create tickets + the private storage channel)
- Manage Roles (Member/Verified/Customer roles — bot role must be **above** them)
- View Channels, Send Messages, Read Message History, Attach Files, Manage Messages
- Embed Links

Recommended permissions integer: **`268528720`** (or simply grant **Administrator** for the simplest setup).

---

## 🚀 Getting Started (Local)

```bash
npm install
cp .env.example .env      # fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm run deploy            # register slash commands to your guild
npm start                 # start the bot + web server
```

`npm run deploy` registers guild commands. **You do not need to redeploy on every start** — only re-run it when command definitions change.

---

## ☁️ Deploying to Render

1. Push this project to GitHub (see below).
2. On [Render](https://render.com): **New → Web Service** → connect your GitHub repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. Add environment variables: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (and optionally `PORT`).
5. Deploy. Render auto-deploys on every push to your default branch.

> A `render.yaml` is included so you can also use Render **Blueprints**.

**No external database setup is required** — storage lives in Discord.

---

## 🐙 Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit: BloxBuilt bot"
git branch -M main
git remote add origin https://github.com/<you>/BloxBuilt.git
git push -u origin main
```

---

## 🟢 First-Time Startup

When the bot first connects it:

1. Connects to Discord and resolves your `GUILD_ID`.
2. Looks for the private storage channel `🔒・bloxbuilt-data`.
3. If missing, creates the private category `🔒 BLOXBUILT SYSTEM` and the channel, locking `@everyone` out and granting only the bot access.
4. Creates the initial empty storage records (`config`, `builds`, `orders`, `reviews`, `state`).
5. Loads everything into memory and becomes ready.

### Commands to run first

```text
/config channel welcome      #welcome
/config channel orders        #order-a-build
/config channel queue         #build-queue
/config channel builds        #available-builds
/config channel reviews       #reviews
/config channel order-logs    #order-logs

/config role owner        @👑・Owner
/config role management   @⚙️・Management
/config role builder      @🔨・Builder
/config role support      @🛟・Support
/config role customer     @⭐・Customer
/config role member       @👤・Member
/config role verified     @✅・Verified

/config verification true

/orders open
/sendorderpanel
/sendqueue

/build add id:BB-001 name:"Modern Family Home" cost:"$185,000" ...
```

> Until roles are configured, **server administrators** are treated as Owner so you can run `/config`.

---

## 💾 How the Discord Storage System Works

Discord is the **source of truth**. The private channel holds one message per record, each carrying a JSON attachment and a stable marker so the bot can rediscover them after any redeploy:

| Marker                | File           |
| --------------------- | -------------- |
| `⚙️ BLOXBUILT CONFIG`  | `config.json`  |
| `🏠 BLOXBUILT BUILDS`  | `builds.json`  |
| `📋 BLOXBUILT ORDERS`  | `orders.json`  |
| `⭐ BLOXBUILT REVIEWS` | `reviews.json` |
| `💾 BLOXBUILT STATE`   | `state.json`   |

**Flow:** load records on startup → validate → cache in memory → on any change, update memory then immediately persist the relevant record back to Discord.

**Safety:**
- Updates are atomic-style: the new JSON is built and validated **before** the existing message is edited, so a failed write never corrupts good data.
- If a record can't be read/parsed, the bot **keeps the existing message**, loads safe defaults into memory only, flags the record, and alerts the owner in the logs channel — it never overwrites corrupt data with blanks.
- The queue message and ticket buttons are recreated/re-routed automatically after restarts.

Because everything is in Discord, a **complete Render redeploy** preserves config, builds, orders, reviews, order numbers, queue state, open/closed state, assigned builders and historical orders.

---

## 🗂️ Backups

- **Create:** `/backup` (owner only) uploads a full `bloxbuilt-backup-YYYY-MM-DD.json` to the private storage channel.
- **Status:** `/storage status` (owner only, ephemeral) shows the storage channel, connection state, counts, open/closed state, last save and last backup.
- **Restore:** download a backup from the storage channel and replace the contents of the relevant record message(s) with the matching section, keeping the marker line intact. The bot re-reads records on the next restart.

---

## 🧭 Command Reference

| Command | Who | Purpose |
| --- | --- | --- |
| `/config channel\|role\|verification\|view` | Owner | Configure the bot |
| `/orders open\|close\|status` | Management | Open/close build ordering |
| `/sendorderpanel` | Management | Post the order panel |
| `/sendqueue` | Management | Create the queue message |
| `/build add\|edit\|remove` | Management | Manage the catalogue |
| `/build view\|list` | Anyone | Browse builds |
| `/order lookup\|status\|close` | Staff | Manage an order |
| `/order assign` | Management | Assign a builder |
| `/backup` | Owner | Full data backup |
| `/storage status` | Owner | Storage diagnostics |

---

## 🔒 Permissions Summary

- **Owner** — configure, manage everything, backups, open/close orders.
- **Management** — manage builds/orders, assign builders, complete/cancel, open/close, send panels.
- **Builder** — work build tickets (accept, be assigned, start, waiting, complete). Cannot configure, manage storage, delete builds, or open/close ordering.
- **Support** — claim and close support tickets.
- **Customers** — never see staff controls.

---

Built for BloxBuilt. 🏡
