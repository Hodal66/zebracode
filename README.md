# ZEBRACODE

Website for **ZEBRACODE**, a Kigali-based digital products, design and technology company.

- **Site:** a static `index.html` (HTML, CSS, vanilla JS) with a logo-animation hero.
- **Inquiries:** the contact form and the quote wizard post to `/api/inquiries` (Vercel serverless function) and are stored in **Neon Postgres**.
- **Dashboard:** `/admin` is a private, login-protected inbox for those inquiries (search, filter by status, notes, CSV export).

```
index.html            public site
admin/index.html      admin dashboard (noindex)
api/inquiries.js      POST: public form endpoint (validation, honeypot, rate limit)
api/admin/*.js        login, logout, list/update, CSV export
lib/                  db (Neon), auth (signed cookie), notify (optional email)
vercel.json           /admin rewrite + security headers
```

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string (added automatically by the Vercel ↔ Neon integration) |
| `SESSION_SECRET` | yes | 24+ random characters; signs the admin session cookie |
| `ADMIN_EMAIL` | yes | admin login email |
| `ADMIN_PASSWORD` | yes | admin login password (use a long, unique one) |
| `RESEND_API_KEY` | no | enables an email alert for every new inquiry |
| `NOTIFY_EMAIL` | no | alert recipient (default `zebracode250@gmail.com`) |
| `NOTIFY_FROM` | no | sender, e.g. `ZEBRACODE <hello@yourdomain.com>` (needs a verified domain in Resend) |

The `inquiries` table is created automatically on the first request.

If the database is unreachable, the forms fall back to opening the visitor's email app, so no lead is silently lost.

## Local development

```bash
npm install
npx vercel dev      # needs the env vars above (e.g. via `vercel env pull`)
```

## Deploy

Every push to `main` deploys on Vercel. `WHATSAPP_NUMBER` in `index.html` shows the floating WhatsApp button when set.
