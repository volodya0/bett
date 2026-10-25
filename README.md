# ⚽ bett

*Gamble-free betting* — football score predictions among friends, for virtual points.
Stack: React + Node.js (Express) + SQLite in a single service. The UI is in Ukrainian.

## How it works

- Sign up with just a username and password. Everyone starts at 0; balances go up and down.
- Optionally, new sign-ups need admin approval (a checkbox in admin settings).
- The admin adds matches — via a form or by pasting JSON (see below). Each player predicts the exact score, which costs the match stake (1 point by default).
- Before kickoff everyone sees **who** is in, but predictions stay hidden until the opening whistle.
- The admin enters the final score and the whole pot is split in proportion to each prediction's weight:
  exact score (10) ≫ winner + goal difference (4) > winner only (2) > off by one goal (1).
- If nobody reaches any of those, the closest prediction(s) by total goal error take the whole pot.
- Every match has a collapsible comment thread.
- The UI is available in Ukrainian and English (switch in the header).
- Admin panel: weights, default stake, invite code, approval, per-match pot bonuses, player balance adjustments, full JSON export.
- Entered a wrong score? "Roll back" voids the payouts so you can enter the correct one.
- **The first registered user becomes admin** (or set `ADMIN_USERNAMES=vova,olia`).

## Adding matches from JSON

Admin → Matches → "Add from JSON". Paste one object or an array:

```json
[
  {
    "home": "Шахтар",
    "away": "Динамо Київ",
    "tournament": "УПЛ, 12 тур",
    "kickoff": "2026-11-01T17:00:00+02:00",
    "stake": 1,
    "bonus": 0
  }
]
```

`home`, `away` and `kickoff` are required; `kickoff` must include a time zone offset (or `Z`).
`tournament`, `stake` (points, defaults to the admin setting) and `bonus` are optional.
A match with the same teams and kickoff as an existing one is skipped.

## Data

Everything lives in one SQLite file (`/opt/kumbet/data/kumbet.db` on the server).
Admin → Settings → "Export JSON" downloads the whole database (no password hashes); amounts are in hundredths of a point.

## Local development

Requires Node.js 22.13+.

```bash
npm install
npm run dev        # API on :3000, frontend on http://localhost:5173
npm test           # pot-distribution tests
```

Production mode: `npm run build && npm start` → http://localhost:3000

## Deployment

The main setup is a free Google Cloud e2-micro VM with auto-deploy via GitHub Actions
(every push to `main` updates the site). Step-by-step guide: **[DEPLOY.md](DEPLOY.md)**.

The app also runs on any host with Docker and a persistent disk (Railway, Fly.io, a VPS):
```bash
docker build -t kumbet .
docker run -d -p 80:3000 -v kumbet-data:/data --restart unless-stopped kumbet
```
To back up, copy `/data/kumbet.db`.

### Environment variables (optional)
| Variable | Purpose |
|---|---|
| `PORT` | port (default 3000) |
| `DATA_DIR` | database directory (`/data` in Docker) |
| `ADMIN_USERNAMES` | usernames that become admins on sign-up |
| `SESSION_SECRET` | session secret (if unset, generated and stored in `DATA_DIR`) |
