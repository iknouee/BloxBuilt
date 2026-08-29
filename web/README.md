# 🏡 BloxBuilt Website

The public build gallery + secret admin panel for **bloxbuilt.xyz**, built with **Next.js (App Router)** and hosted on **Vercel**.

- **Public site** — animated blueprint grid background, searchable build gallery, and a detailed build modal (uploader, prices, **Copy ID**, category, description, required gamepasses, image gallery).
- **Admin panel** — a secret URL where you add / edit / delete builds and upload images. No login screen; the URL itself is the key (plus a second API key protects the data).
- **Storage** — builds live in **Vercel KV**; images live in **Vercel Blob**. No database to manage.

> This is a separate app from the Discord bot. The bot still uses its own Discord-channel storage; the website is independent.

---

## 🚀 Deploy to Vercel (step by step)

### 1. Import the project
- Push this repo to GitHub (it already lives under `web/` in the BloxBuilt repo).
- On [Vercel](https://vercel.com): **Add New → Project → Import** your repo.
- **Set the Root Directory to `web`** (important — the site isn't at the repo root).
- Framework preset: **Next.js** (auto-detected). Build/output settings: leave default.

### 2. Add storage (this creates the KV + Blob env vars for you)
In your Vercel project:
- **Storage → Create Database → KV** (Upstash Redis). Connect it to the project.
  - This auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- **Storage → Create → Blob**. Connect it to the project.
  - This auto-adds `BLOB_READ_WRITE_TOKEN`.

You don't paste those tokens by hand — Vercel injects them.

### 3. Add the admin environment variables
**Project → Settings → Environment Variables** — add:

| Variable | Value |
| --- | --- |
| `ADMIN_SECRET` | A long random string. This becomes your admin URL path. |
| `ADMIN_API_KEY` | A **different** long random string. Protects the write API. |
| `NEXT_PUBLIC_DISCORD_INVITE` | Your Discord invite link (optional). |

Generate strong random values (any of these):
```bash
openssl rand -hex 24
# or
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 4. Redeploy
After adding storage + env vars, trigger a redeploy so they take effect.

---

## 🔐 Using the admin panel

Your admin panel lives at:

```
https://bloxbuilt.xyz/admin/<ADMIN_SECRET>
```

For example, if `ADMIN_SECRET=f8Ha93kLm20xQ...`, visit
`https://bloxbuilt.xyz/admin/f8Ha93kLm20xQ...`.

- Anyone visiting the wrong path just sees a neutral "Page not found."
- Even if someone guessed the URL, they **can't add or delete builds** without the `ADMIN_API_KEY` (the panel sends it automatically as the `x-admin-key` header; it's never shown on the public site).

**In the panel you can:**
- Add a build — name, description, category, cash price, Blockbux, uploader, required gamepasses, and image uploads (first image is the cover).
- Edit or delete any existing build.
- Each build gets a generated **Build ID** shown in its row — that's what customers copy into your Discord bot.

---

## 🖥️ Local development

```bash
cd web
npm install
cp .env.example .env.local   # fill in ADMIN_SECRET, ADMIN_API_KEY, invite
npm run dev                  # http://localhost:3000
```

> KV and Blob calls need real Vercel credentials. For full local testing, pull them with the Vercel CLI:
> ```bash
> npm i -g vercel
> vercel link
> vercel env pull .env.local
> ```
> Without KV/Blob credentials the public gallery still renders (empty) and the UI works, but saving builds/uploading images will error until credentials are present.

---

## 🗂️ Project structure

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx            root layout + animated background
│   │   ├── page.tsx              public home (hero + gallery)
│   │   ├── globals.css           theme + animated grid
│   │   ├── admin/[secret]/page.tsx   secret-gated admin page
│   │   └── api/
│   │       ├── builds/route.ts        GET list · POST create
│   │       ├── builds/[id]/route.ts   GET · PUT · DELETE
│   │       └── upload/route.ts        image upload → Vercel Blob
│   ├── components/
│   │   ├── Header.tsx  Footer.tsx
│   │   ├── Gallery.tsx  BuildCard.tsx  BuildModal.tsx
│   │   └── AdminPanel.tsx
│   └── lib/
│       ├── types.ts   store.ts (KV)   auth.ts   format.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
└── .env.example
```

---

## Environment variables summary

| Variable | Who sets it | Purpose |
| --- | --- | --- |
| `ADMIN_SECRET` | You | Secret path segment for the admin URL |
| `ADMIN_API_KEY` | You | Authorizes create/update/delete/upload |
| `NEXT_PUBLIC_DISCORD_INVITE` | You (optional) | "Join Discord" links |
| `KV_REST_API_URL` | Vercel (KV) | Build storage |
| `KV_REST_API_TOKEN` | Vercel (KV) | Build storage |
| `BLOB_READ_WRITE_TOKEN` | Vercel (Blob) | Image uploads |

Built for BloxBuilt. 🏡
