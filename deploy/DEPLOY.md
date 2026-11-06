# Putting Brief on your own server

This is the plain, tested route: one small Linux server (a VPS), Brief running as a normal Node program, Caddy in front for https, and Cloudflare in front of that. The database stays on Supabase.

**What "tested" means here:** the Node build, `npm start`, the health check and the news schedule were run and checked. The pm2, Caddy and systemd files are standard but were not run on a real server, so read them once and treat the first deploy as the test.

## What you need
- A VPS with Ubuntu 22.04 or 24.04, 1 CPU and 2 GB of memory is enough to start (it handles thousands of readers at once because the pages and news are cached). Pick a region near most of your readers (Johannesburg or Cape Town for Africa, otherwise Europe) and, if you can, the same region as your Supabase project.
- A domain name, and a Cloudflare account (free) managing its DNS. Cloudflare also tells Brief which country each visitor is in, which is how readers land on their own region first.
- Your Supabase project, with `supabase-setup.sql` already run (see SETUP.md).

## 1. Prepare the server (once)
```bash
# as root, or with sudo
adduser --disabled-password --gecos "" brief
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs unzip
npm install -g pm2
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy.list
apt-get update && apt-get install -y caddy
```

## 2. Put Brief on the server
From your computer, upload the zip (`scp Brief.zip brief@YOUR_SERVER:/home/brief/`), then on the server:
```bash
su - brief
unzip -o Brief.zip -d app && cd app
cp .env.example .env && nano .env      # fill it in (SETUP.md explains each line); then: chmod 600 .env
npm install                              # a .npmrc in the project makes this work
npm run doctor                           # tells you exactly what is missing
npm run build:node                       # the VITE_ lines in .env are baked into the pages here, so build AFTER editing .env
```
Keep `VITE_SITE_URL=https://your-domain` and `INGEST_KEY=` (a long random text) in `.env`.

## 3. Run it
```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup               # run the one command it prints, so Brief starts again after a reboot
curl http://127.0.0.1:3000/api/public/health
```
`npm start` (which pm2 runs) also refreshes every edition and saves the headlines every 20 minutes. Change that with `INGEST_EVERY_MINUTES` in `.env`, or set it to 0 if you call `/api/public/ingest` from your own scheduler. Keep **one copy** running.

## 4. Https and the domain
1. As root: copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile`, replace `example.com` with your domain, then `systemctl reload caddy`.
2. In Cloudflare DNS, add an `A` record for your domain (and `www`) to the server's IP, proxy on (orange cloud). Set SSL/TLS mode to **Full (strict)**.
3. Open your domain. Check `https://your-domain/api/public/health`.

## 5. After the first run
- Call the scheduler once by hand and read the report: `npm run ingest -- https://your-domain`. Any outlet that returned nothing is listed under `emptyFeeds` (see SETUP.md); fix or delete those addresses in `src/lib/editions.server.ts`.
- Add a free uptime monitor (UptimeRobot or similar) on `/api/public/health`, alerting you by email or SMS.
- Supabase's free plan does not keep backups. Turn on its backups (paid) or export the database on a schedule before the site matters to you.

## Updating
```bash
# upload the new zip, then on the server (as brief):
cd ~ && unzip -o Brief.zip -d app && cd app
npm install && npm run build:node && pm2 reload brief
```
If something is wrong, unzip the previous zip the same way, build, and `pm2 reload brief`. Keep the last two zips. When a release says "run `supabase-setup.sql` again", do that in Supabase (it is safe to repeat) before or right after the deploy.

## Useful commands
`pm2 logs brief` (log), `pm2 status`, `pm2 reload brief` (restart without dropping requests), `journalctl -u caddy -f` (web server log).

## Using systemd instead of pm2
Copy `deploy/brief.service` to `/etc/systemd/system/`, adjust the paths, and `systemctl enable --now brief`.

## If you would rather stay on Cloudflare Workers or Lovable
`npm run build` still builds for Cloudflare, as before. On that target the in-memory caches live per Worker instance, `npm start` and its schedule do not run (call `/api/public/ingest` from a Cloudflare Cron Trigger or any scheduler instead), and the AI trail researcher is limited by Workers' time limits.
