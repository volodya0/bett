# ⚽ bett

*Gamble-free betting* — football score predictions among friends, for virtual points.
Stack: React + Node.js (Express) + SQLite in a single service. The UI is in Ukrainian.

## How it works

- Sign up with just a username and password. New players get starting points.
- The admin adds matches. Each player predicts the exact score, which costs the match stake (1 point by default).
- Before kickoff everyone sees **who** is in, but predictions stay hidden until the opening whistle.
- The admin enters the final score and the pot is split in proportion to each prediction's weight:
  exact score (10) ≫ winner + goal difference (4) > winner only (2) > off by one goal (1).
- If nobody gets anything, the pot goes into a 🎰 jackpot that the next exact-score guessers take
  (or stakes are refunded — configurable).
- Everything is configurable in the admin panel: weights, stakes, starting balance, invite code, per-match pot bonuses.
- Entered a wrong score? "Roll back" voids the payouts so you can enter the correct one.
- **The first registered user becomes admin** (or set `ADMIN_USERNAMES=vova,olia`).

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

## 🥚 Easter eggs
Not telling. Okay, one: ↑↑↓↓←→←→BA.
