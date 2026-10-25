# 🚀 Deploying to Google Cloud (free e2-micro)

The VM runs two copies of the app, each with its own database:

| Copy | Address | Updated by |
|---|---|---|
| **Test** | `https://test.<domain>` | every `git push` to `main` (automatic, ~2–3 min) |
| **Production** | `https://<domain>` | **Actions → Deploy production → Run workflow** — ships the exact build that is on test |

`<domain>` is your own domain if you set the `DOMAIN` secret, otherwise `34-123-45-67.sslip.io` (the VM IP with dashes).
The test copy shows a red **TEST** badge in the header. Each deploy backs up the database it touches;
the version (short commit hash) is shown in the site footer.

Setup is done once and takes about 20 minutes, all in the browser — nothing to install.

---

## Step 1. Deploy SSH key (2 min)

1. Open https://console.cloud.google.com and click the **Cloud Shell** icon `>_` in the top right.
2. Run:
   ```bash
   ssh-keygen -t ed25519 -N "" -C deploy -f deploy_key
   cat deploy_key.pub
   ```
3. Copy the printed line (it ends with `deploy`). This is the **public** key, needed in step 2.

## Step 2. Virtual machine (5 min)

1. If Google asks, create a project and attach billing (a card). Nothing is charged within the free tier.
2. **Compute Engine → VM instances → Create instance**:

   | Field | Value |
   |---|---|
   | Name | `kumbet` |
   | Region | **us-central1**, us-east1 or us-west1 (only these are free) |
   | Machine type | **e2-micro** |
   | Boot disk → Change | Debian 12, type **Standard persistent disk**, 30 GB (⚠️ not "Balanced" — that one is paid) |
   | Firewall | ✅ Allow HTTP traffic, ✅ Allow HTTPS traffic |
   | Security → Manage access → Add item (SSH keys) | paste the public key from step 1 |

3. Click **Create**. Copy the **External IP**, e.g. `34.123.45.67`.
4. Recommended: make the IP static so it doesn't change after a VM restart:
   **VPC network → IP addresses** → next to the VM's address, click **Promote to static**.

> 💡 Set a spending limit: **Billing → Budgets & alerts → Create budget**, $1. If anything starts costing money (e.g. Google changes the terms for external IPs), you'll get an email.

## Step 3. GitHub secrets (3 min)

Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `VM_HOST` | External IP from step 2 |
| `VM_SSH_KEY` | the **private** key: run `cat deploy_key` in Cloud Shell and copy everything, including the `-----BEGIN…` and `-----END…` lines |
| `ADMIN_USERNAMES` | *(optional)* your username, e.g. `vova` |
| `DOMAIN` | *(optional)* your own domain, if you have one. Otherwise the address is `34-123-45-67.sslip.io` |

Then delete the keys from Cloud Shell: `rm deploy_key deploy_key.pub`.

## Step 4. First deploy

Push to `main`, or open **Actions → Deploy test → Run workflow**.
The first run takes longer (~5 min) because Docker gets installed on the VM. The first deploy also starts production
from the same build. At the end, Actions shows a link to the test site.

Open each site and **register first**: in each copy the first user becomes admin (or use `ADMIN_USERNAMES`).

---

## Day-to-day

| Task | How |
|---|---|
| Update the test site | `git push` to `main`, wait ~2–3 min |
| Ship to production | Actions → **Deploy production** → Run workflow |
| Watch a deploy | the **Actions** tab on GitHub |
| Redeploy test without changes | Actions → Deploy test → **Run workflow** |
| Roll back | `git revert <commit>`, push, check on test, then Deploy production |
| App logs | Compute Engine → **SSH** button next to the VM → `cd /opt/kumbet && docker compose logs -f app-prod` (or `app-test`) |
| Databases | `/opt/kumbet/prod/data/kumbet.db` and `/opt/kumbet/test/data/kumbet.db` |
| Backups | `/opt/kumbet/backups/` (`prod-…`, `test-…`): daily at 04:17 and before every deploy, kept for 30 days |
| Download a backup | in the SSH window: gear ⚙️ → **Download file** → `/opt/kumbet/backups/…` |

## Troubleshooting

- **Deploy fails at SSH**: check `VM_HOST` and `VM_SSH_KEY`; the key must be pasted in full.
- **Site doesn't open over HTTPS**: make sure the HTTP/HTTPS boxes were ticked when creating the VM. Check the logs: `docker compose logs caddy`.
- **sslip.io fails to get a certificate** (can happen due to Let's Encrypt limits): get a free domain at https://www.duckdns.org, point it at the VM's IP and add the `DOMAIN` secret.
