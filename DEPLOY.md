# 🚀 Деплой на Google Cloud (безкоштовна e2-micro)

Після налаштування кожен `git push` у гілку `main` сам оновлює сайт приблизно за 2–3 хвилини:
GitHub Actions проганяє тести, збирає Docker-образ, робить бекап бази, копіює образ на VM і перевіряє, що сайт живий.
Версія (короткий хеш коміту) показується внизу сайту, тож одразу видно, що оновилось.

Налаштування роблять один раз, приблизно за 20 хвилин. Усе відбувається в браузері, нічого встановлювати не треба.

---

## Крок 1. SSH-ключ для деплою (2 хв)

1. Відкрийте https://console.cloud.google.com і натисніть іконку **Cloud Shell** `>_` угорі праворуч.
2. Виконайте:
   ```bash
   ssh-keygen -t ed25519 -N "" -C deploy -f deploy_key
   cat deploy_key.pub
   ```
3. Скопіюйте рядок, який вивелось (він закінчується на `deploy`). Це **публічний** ключ, він знадобиться на кроці 2.

## Крок 2. Віртуальна машина (5 хв)

1. Якщо Google попросить, створіть проєкт і підключіть білінг (картку). У межах безкоштовного тарифу з неї нічого не списується.
2. **Compute Engine → VM instances → Create instance**:

   | Поле | Значення |
   |---|---|
   | Name | `kumbet` |
   | Region | **us-central1**, us-east1 або us-west1 (безкоштовно лише в цих регіонах) |
   | Machine type | **e2-micro** |
   | Boot disk → Change | Debian 12, тип **Standard persistent disk**, 30 GB (⚠️ не «Balanced», бо він платний) |
   | Firewall | ✅ Allow HTTP traffic, ✅ Allow HTTPS traffic |
   | Security → Manage access → Add item (SSH keys) | вставте публічний ключ із кроку 1 |

3. **Create**. Скопіюйте **External IP**, наприклад `34.123.45.67`.
4. Радимо зафіксувати IP, щоб він не змінився після перезапуску VM:
   **VPC network → IP addresses** → біля адреси VM натисніть **Promote to static**.

> 💡 Поставте ліміт витрат: **Billing → Budgets & alerts → Create budget**, $1. Якщо щось почне коштувати гроші (наприклад, Google змінить умови для зовнішнього IP), вам прийде лист.

## Крок 3. Секрети в GitHub (3 хв)

Репозиторій → **Settings → Secrets and variables → Actions → New repository secret**:

| Секрет | Значення |
|---|---|
| `VM_HOST` | External IP з кроку 2 |
| `VM_SSH_KEY` | **приватний** ключ: у Cloud Shell виконайте `cat deploy_key` і скопіюйте все, разом із рядками `-----BEGIN…` і `-----END…` |
| `ADMIN_USERNAMES` | *(необовʼязково)* ваш логін, наприклад `vova` |
| `DOMAIN` | *(необовʼязково)* власний домен, якщо є. Без нього адреса буде `34-123-45-67.sslip.io` |

Після цього видаліть ключі з Cloud Shell: `rm deploy_key deploy_key.pub`.

## Крок 4. Перший деплой

Зробіть push у `main` або відкрийте **Actions → Deploy → Run workflow**.
Перший запуск триває довше (~5 хв), бо на VM ставиться Docker. У кінці в Actions зʼявиться посилання на сайт.

Відкрийте сайт і **зареєструйтеся першим**: перший користувач стає адміном.

---

## Щоденна робота

| Що треба | Як |
|---|---|
| Оновити сайт | `git push` у `main` і ~2–3 хв почекати |
| Подивитись, як іде деплой | вкладка **Actions** у GitHub |
| Передеплоїти без змін | Actions → Deploy → **Run workflow** |
| Відкотитись на стару версію | `git revert <коміт>` і push |
| Логи апки | Compute Engine → кнопка **SSH** біля VM → `cd /opt/kumbet && docker compose logs -f app` |
| Бекапи | `/opt/kumbet/backups/`: щодня о 04:17 і перед кожним деплоєм, зберігаються 30 днів |
| Скачати бекап | у вікні SSH: шестерня ⚙️ → **Download file** → `/opt/kumbet/backups/…` |

## Якщо щось не так

- **Деплой упав на SSH**: перевірте `VM_HOST` і `VM_SSH_KEY`; ключ має бути вставлений повністю.
- **Сайт не відкривається по HTTPS**: перевірте, що при створенні VM стоять галочки HTTP/HTTPS. Подивіться логи: `docker compose logs caddy`.
- **sslip.io не видає сертифікат** (буває через ліміти Let's Encrypt): візьміть безкоштовний домен на https://www.duckdns.org, спрямуйте його на IP VM і додайте секрет `DOMAIN`.
