import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const uk = {
  // nav & layout
  'nav.matches': 'Головна',
  'nav.history': 'Історія',
  'nav.rules': 'Правила',
  'nav.admin': 'Адмінка',
  'nav.logout': 'Вийти',
  'balance.title': 'Балік',
  'footer.note': 'Граємо на поінти. Без грошей, тільки понти',
  'footer.quoteHint': 'Клікни — буде інша',

  // auth
  'auth.tagline': 'Ставим на точний рахунок, поки безкоштовно',
  'auth.login': 'Вхід',
  'auth.register': 'Реєстрація',
  'auth.username': 'Логін',
  'auth.password': 'Пароль',
  'auth.invite': 'Код запрошення',
  'auth.invitePlaceholder': 'спитай у адміна',
  'auth.submitLogin': 'Увійти',
  'auth.submitRegister': 'Зареєструватися',
  'auth.howItWorks': 'Як це працює?',
  'auth.welcome': 'Понеслась',

  // match list
  'matches.open': 'Можна ставити',
  'matches.openEmpty': 'Матчів поки нема.',
  'matches.live': 'Грають / чекаємо рахунок',
  'matches.done': 'Завершені',
  'match.default': 'Матч',
  'match.cancelled': 'скасовано',
  'match.myBet': 'Мій прогноз:',
  'match.miss': 'мимо',
  'match.makeBet': 'Поставити {stake}',
  'match.notIn': 'Пропустив',
  'match.bonus': '+бонус',

  // match page
  'match.back': 'Усі матчі',
  'match.stake': 'ставка',
  'match.participants': 'учасників',
  'match.pot': 'банк',
  'match.potWithBonus': 'банк (вкл. бонус {bonus})',
  'match.toKickoff': 'до старту',
  'match.startsIn': 'через {time}',
  'match.finished': 'завершено',
  'match.inPlay': 'йде гра',
  'match.people': 'Учасники',
  'match.hiddenNote': 'Чужі прогнози відкриються на стартовому свистку.',
  'match.nobody': 'Поки ніхто не поставив. Будь першим!',
  'match.me': ' (я)',
  'match.secret': 'Секрет до старту матчу',
  'predict.title': 'Твій прогноз',
  'predict.titleEdit': 'Твій прогноз (можна змінити до старту)',
  'predict.place': 'Летс гоу!',
  'predict.update': 'Оновити прогноз',
  'predict.withdraw': 'Забрати ставку',
  'predict.withdrawConfirm': 'Забрати ставку? Бали повернуться.',
  'predict.placed': 'Ставка є! −{stake}',
  'predict.updated': 'Переписав',
  'predict.withdrawn': 'Ставку забрав',
  'result.won': '{label}! {score} зайшло: +{payout}',
  'result.lost': '{score} не зайшло. Буває.',

  // tiers
  'tier.exact': 'Точний рахунок',
  'tier.diff': 'Результат + різниця',
  'tier.outcome': 'Результат',
  'tier.near': 'Майже',
  'tier.closest': 'Найближчий',

  // leaderboard
  'table.title': 'Рейтинг',
  'table.player': 'Гравець',
  'table.bets': 'Ставок',
  'table.betsHint': 'Кількість ставок',
  'table.hits': 'Влучань',
  'table.hitsHint': 'Ставки, що принесли хоч щось',
  'table.exactHint': 'Точних рахунків',
  'table.exact': 'Точних',
  'table.balance': 'Рейтинг',

  // history
  'history.title': 'Історія рейтингу',
  'history.empty': 'Поки порожньо.',
  'history.stake': 'Ставка: {match}',
  'history.payout': 'Виграш: {match}',
  'history.refund': 'Повернення: {match}',
  'history.admin': 'Коригування від адміна',
  'history.legacy': 'Інше',

  // rules
  'rules.title': 'Правила гри',
  'rules.1': 'Рейтинг як у шахах: усі стартують з 0, а далі — плюс чи мінус залежно від прогнозів.',
  'rules.2': 'На кожен матч можна вписати <b>точний рахунок</b>. Прогноз коштує ставку матчу (зазвичай <b>{stake}</b>). Змінити або забрати прогноз можна до стартового свистка.',
  'rules.3': 'До старту видно, <b>хто</b> в грі, але не <b>що</b> поставив.',
  'rules.4': 'Після фінального свистка весь банк матчу ділиться між тими, хто був близько — пропорційно «вазі» прогнозу:',
  'rules.colPrediction': 'Прогноз',
  'rules.colExample': 'Приклад (факт 2:1)',
  'rules.colWeight': 'Вага',
  'rules.exact': 'Точний рахунок',
  'rules.diff': 'Переможець + різниця голів',
  'rules.outcome': 'Лише переможець / нічия',
  'rules.near': 'Майже (помилка на 1 гол)',
  'rules.miss': 'Мимо',
  'rules.example': '<b>Приклад:</b> 4 гравці по 1 балу, банк = 4. Один вгадав точно (вага {wExact}), інший — лише переможця (вага {wOutcome}), двоє мимо. Перший отримує {a}, другий — {b}.',
  'rules.closest': 'Якщо ніхто не потрапив у жодну категорію, банк повністю забирає найближчий прогноз (за сумарною помилкою в голах). Якщо таких кілька — діляться порівну.',
  'rules.cancel': 'Скасований матч = усі ставки повертаються.',

  // 404
  'notFound.title': '404',
  'notFound.text': 'Такої сторінки не існує.',
  'notFound.back': 'На головну',

  // admin
  'admin.matches': 'Матчі',
  'admin.players': 'Гравці',
  'admin.settings': 'Налаштування',
  'admin.newMatch': 'Новий матч',
  'admin.editMatch': 'Редагувати: {match}',
  'admin.home': 'Господарі',
  'admin.away': 'Гості',
  'admin.tournament': 'Турнір',
  'admin.kickoff': 'Початок',
  'admin.stake': 'Ставка (бали)',
  'admin.stakeDefault': 'за замовч.',
  'admin.bonus': 'Бонус у банк',
  'admin.bonusHint': 'Бали «від дому», які додаються до банку матчу',
  'admin.save': 'Зберегти',
  'admin.add': 'Додати матч',
  'admin.cancelEdit': 'Скасувати редагування',
  'admin.added': 'Матч додано',
  'admin.updated': 'Матч оновлено',
  'admin.active': 'Активні матчі',
  'admin.none': 'Немає.',
  'admin.closed': 'Закриті',
  'admin.final': 'Фінал',
  'admin.cancelMatch': 'Скасувати',
  'admin.reopen': 'Відкотити',
  'admin.cancelledTag': ' · скасовано',
  'admin.matchInfo': '{when} · ставка {stake} · учасників {people} · банк {pot}',
  'admin.confirmEarly': 'Матч ще не почався за розкладом. Все одно внести результат?',
  'admin.confirmResult': 'Підтвердити рахунок {score}? Бали розподіляться одразу.',
  'admin.resultSaved': 'Результат внесено, бали розподілено',
  'admin.confirmCancel': 'Скасувати матч? Усім повернуться ставки.',
  'admin.cancelled': 'Матч скасовано',
  'admin.confirmReopen': 'Відкотити результат? Виплати буде анульовано, матч знову стане відкритим (можна внести правильний рахунок).',
  'admin.reopened': 'Результат відкочено',
  'admin.confirmDelete': 'Видалити матч назавжди?',
  'admin.deleted': 'Видалено',
  'admin.importTitle': 'Додати з JSON',
  'admin.importHint': 'Вставте обʼєкт матчу або масив матчів. Час — з часовим поясом.',
  'admin.importPreview': 'Буде додано: {n}',
  'admin.importInvalid': 'Невалідний JSON: {error}',
  'admin.importButton': 'Імпортувати',
  'admin.aiTitle': 'Промпт для AI',
  'admin.aiHint': 'Скопіюй, встав у ChatGPT / Claude разом із посиланням на матч — і встав сюди JSON, який він поверне.',
  'admin.aiCopy': 'Скопіювати',
  'admin.aiCopied': 'Скопійовано',
  'admin.aiPrompt': `Зроби JSON для імпорту футбольних матчів на мій сайт.

Матчі: [ВСТАВ ПОСИЛАННЯ АБО ОПИС МАТЧІВ]

Формат — масив обʼєктів, без пояснень і без markdown, тільки чистий JSON:
[
  {
    "home": "Назва господарів",
    "away": "Назва гостей",
    "tournament": "Турнір, тур (коротко)",
    "kickoff": "2026-11-01T19:00:00+02:00"
  }
]

Правила:
- "kickoff" — точний час початку в ISO 8601 ОБОВʼЯЗКОВО з часовим поясом. Використовуй київський час: +02:00 взимку, +03:00 влітку.
- Назви команд — українською, як їх зазвичай пишуть (напр. "Динамо Київ", "Реал Мадрид").
- Якщо не впевнений у даті чи часі — перевір на офіційному сайті турніру; не вигадуй.
- Поля "stake" і "bonus" не додавай, якщо я окремо не попрошу.`,
  'admin.importDone': 'Додано: {created}, пропущено дублікатів: {skipped}',
  'admin.playersTitle': 'Гравці ({n})',
  'admin.colUser': 'Логін',
  'admin.colBalance': 'Рейтинг',
  'admin.colAdmin': 'Адмін',
  'admin.adjustButton': '± рейтинг',
  'admin.adjustPrompt': 'Скільки додати до рейтингу {user}? (мінус — забрати)',
  'admin.adjustNote': 'Коментар (видно гравцю в історії)',
  'admin.adjusted': 'Рейтинг змінено',
  'admin.passwordPrompt': 'Новий пароль для {user}:',
  'admin.passwordChanged': 'Пароль змінено',
  'admin.siteName': 'Назва сайту',
  'admin.invite': 'Код запрошення',
  'admin.invitePlaceholder': 'порожньо = реєстрація відкрита',
  'admin.defaultStake': 'Ставка за замовчуванням',
  'admin.weights': 'Ваги прогнозів',
  'admin.weightsHint': 'Банк матчу ділиться пропорційно вагам. Чим більша вага точного рахунку відносно інших — тим більший приз за нього.',
  'admin.saved': 'Збережено',
  'admin.data': 'Дані',
  'admin.export': 'Експорт JSON',
  'admin.exportHint': 'Уся база одним файлом (без паролів). Суми — у сотих балу.',
  'admin.requireApproval': 'Нові гравці потребують схвалення',
  'admin.pending': 'Чекає',
  'admin.edit': 'Редагувати',
  'admin.delete': 'Видалити',
  'admin.password': 'Пароль',
  'admin.approve': 'Схвалити',
  'admin.reject': 'Відхилити',
  'admin.approved': '{user} схвалено',
  'admin.confirmReject': 'Відхилити й видалити акаунт {user}?',
  'admin.rejected': 'Акаунт видалено',
  'pending.title': 'Майже готово',
  'pending.text': 'Акаунт {user} створено. Адмін має його схвалити — після цього можна буде робити прогнози.',
  'pending.check': 'Перевірити ще раз',
  'comments.button': 'Коментарі',
  'comments.empty': 'Ще ніхто нічого не написав.',
  'comments.placeholder': 'Що думаєш про матч?',
  'comments.send': 'Надіслати',
  'comments.delete': 'Видалити',
  'comments.confirmDelete': 'Видалити коментар?',
};

const en = {
  'nav.matches': 'Home',
  'nav.history': 'History',
  'nav.rules': 'Rules',
  'nav.admin': 'Admin',
  'nav.logout': 'Log out',
  'balance.title': 'Rating',
  'footer.note': 'Playing for points. No money, just bragging rights',
  'footer.quoteHint': 'Click for another one',

  'auth.tagline': 'Bet on the exact score. Free, for now.',
  'auth.login': 'Log in',
  'auth.register': 'Sign up',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.invite': 'Invite code',
  'auth.invitePlaceholder': 'ask the admin',
  'auth.submitLogin': 'Log in',
  'auth.submitRegister': 'Sign up',
  'auth.howItWorks': 'How does it work?',
  'auth.welcome': 'Here we go',

  'matches.open': 'Open for predictions',
  'matches.openEmpty': 'No matches yet.',
  'matches.live': 'In play / waiting for the score',
  'matches.done': 'Finished',
  'match.default': 'Match',
  'match.cancelled': 'cancelled',
  'match.myBet': 'My prediction:',
  'match.miss': 'missed',
  'match.makeBet': 'Place a bet {stake}',
  'match.notIn': 'Skipped',
  'match.bonus': '+bonus',

  'match.back': 'All matches',
  'match.stake': 'stake',
  'match.participants': 'players',
  'match.pot': 'pot',
  'match.potWithBonus': 'pot (incl. bonus {bonus})',
  'match.toKickoff': 'to kickoff',
  'match.startsIn': 'starts in {time}',
  'match.finished': 'finished',
  'match.inPlay': 'in play',
  'match.people': 'Players',
  'match.hiddenNote': "Others' predictions are revealed at kickoff.",
  'match.nobody': 'No predictions yet. Be the first!',
  'match.me': ' (me)',
  'match.secret': 'Secret until kickoff',
  'predict.title': 'Your prediction',
  'predict.titleEdit': 'Your prediction (can be changed until kickoff)',
  'predict.place': "Let's go!",
  'predict.update': 'Update prediction',
  'predict.withdraw': 'Withdraw bet',
  'predict.withdrawConfirm': 'Withdraw your bet? The stake will be refunded.',
  'predict.placed': "Bet's in! −{stake}",
  'predict.updated': 'Changed',
  'predict.withdrawn': 'Bet withdrawn',
  'result.won': '{label}! {score} came in: +{payout}',
  'result.lost': "{score} didn't come in. Happens.",

  'tier.exact': 'Exact score',
  'tier.diff': 'Outcome + difference',
  'tier.outcome': 'Outcome',
  'tier.near': 'Close',
  'tier.closest': 'Closest',

  'table.title': 'Rating',
  'table.player': 'Player',
  'table.bets': 'Bets',
  'table.betsHint': 'Number of bets',
  'table.hits': 'Hits',
  'table.hitsHint': 'Bets that paid anything',
  'table.exactHint': 'Exact scores',
  'table.exact': 'Exact',
  'table.balance': 'Rating',

  'history.title': 'Rating history',
  'history.empty': 'Nothing yet.',
  'history.stake': 'Bet: {match}',
  'history.payout': 'Win: {match}',
  'history.refund': 'Refund: {match}',
  'history.admin': 'Admin adjustment',
  'history.legacy': 'Other',


  'rules.title': 'Rules',
  'rules.1': 'Rating, chess-style: everyone starts at 0 and goes up or down with their predictions.',
  'rules.2': 'For each match you predict the <b>exact score</b>. A prediction costs the match stake (usually <b>{stake}</b>). You can change or withdraw it until kickoff.',
  'rules.3': 'Before kickoff you can see <b>who</b> is in, but not <b>what</b> they picked.',
  'rules.4': "After the final whistle the whole pot is split among those who were close, in proportion to the prediction's weight:",
  'rules.colPrediction': 'Prediction',
  'rules.colExample': 'Example (actual 2:1)',
  'rules.colWeight': 'Weight',
  'rules.exact': 'Exact score',
  'rules.diff': 'Winner + goal difference',
  'rules.outcome': 'Winner / draw only',
  'rules.near': 'Close (off by 1 goal)',
  'rules.miss': 'Miss',
  'rules.example': '<b>Example:</b> 4 players bet 1 point each, pot = 4. One gets the exact score (weight {wExact}), another only the winner (weight {wOutcome}), two miss. The first gets {a}, the second {b}.',
  'rules.closest': 'If nobody reaches any category, the closest prediction (by total goal error) takes the whole pot. Ties split it evenly.',
  'rules.cancel': 'A cancelled match = all stakes are refunded.',

  'notFound.title': '404',
  'notFound.text': "This page doesn't exist.",
  'notFound.back': 'Go home',

  'admin.matches': 'Matches',
  'admin.players': 'Players',
  'admin.settings': 'Settings',
  'admin.newMatch': 'New match',
  'admin.editMatch': 'Edit: {match}',
  'admin.home': 'Home',
  'admin.away': 'Away',
  'admin.tournament': 'Tournament',
  'admin.kickoff': 'Kickoff',
  'admin.stake': 'Stake (points)',
  'admin.stakeDefault': 'default',
  'admin.bonus': 'Pot bonus',
  'admin.bonusHint': 'House points added to the match pot',
  'admin.save': 'Save',
  'admin.add': 'Add match',
  'admin.cancelEdit': 'Cancel editing',
  'admin.added': 'Match added',
  'admin.updated': 'Match updated',
  'admin.active': 'Active matches',
  'admin.none': 'None.',
  'admin.closed': 'Closed',
  'admin.final': 'Final',
  'admin.cancelMatch': 'Cancel',
  'admin.reopen': 'Roll back',
  'admin.cancelledTag': ' · cancelled',
  'admin.matchInfo': '{when} · stake {stake} · players {people} · pot {pot}',
  'admin.confirmEarly': "The match hasn't started per schedule. Enter the result anyway?",
  'admin.confirmResult': 'Confirm score {score}? Points are distributed immediately.',
  'admin.resultSaved': 'Result saved, points distributed',
  'admin.confirmCancel': 'Cancel the match? All stakes will be refunded.',
  'admin.cancelled': 'Match cancelled',
  'admin.confirmReopen': 'Roll back the result? Payouts are voided and the match reopens (so you can enter the correct score).',
  'admin.reopened': 'Result rolled back',
  'admin.confirmDelete': 'Delete the match permanently?',
  'admin.deleted': 'Deleted',
  'admin.importTitle': 'Add from JSON',
  'admin.importHint': 'Paste a match object or an array of matches. Times must include a time zone.',
  'admin.importPreview': 'Will add: {n}',
  'admin.importInvalid': 'Invalid JSON: {error}',
  'admin.importButton': 'Import',
  'admin.aiTitle': 'Prompt for AI',
  'admin.aiHint': 'Copy it into ChatGPT / Claude together with a link to the match, then paste the JSON it returns here.',
  'admin.aiCopy': 'Copy',
  'admin.aiCopied': 'Copied',
  'admin.aiPrompt': `Build JSON for importing football matches into my site.

Matches: [PASTE A LINK OR DESCRIBE THE MATCHES]

Format — an array of objects, no explanations and no markdown, just plain JSON:
[
  {
    "home": "Home team",
    "away": "Away team",
    "tournament": "Competition, round (short)",
    "kickoff": "2026-11-01T19:00:00+02:00"
  }
]

Rules:
- "kickoff" is the exact start time in ISO 8601 and MUST include a time zone offset. Use Kyiv time: +02:00 in winter, +03:00 in summer.
- Team names as they are commonly written (e.g. "Dynamo Kyiv", "Real Madrid").
- If you're unsure about a date or time, check the competition's official site; don't make it up.
- Don't add "stake" or "bonus" unless I ask.`,
  'admin.importDone': 'Added: {created}, duplicates skipped: {skipped}',
  'admin.playersTitle': 'Players ({n})',
  'admin.colUser': 'Username',
  'admin.colBalance': 'Rating',
  'admin.colAdmin': 'Admin',
  'admin.adjustButton': '± rating',
  'admin.adjustPrompt': "How much to add to {user}'s rating? (negative to take away)",
  'admin.adjustNote': 'Comment (shown in the player history)',
  'admin.adjusted': 'Rating changed',
  'admin.passwordPrompt': 'New password for {user}:',
  'admin.passwordChanged': 'Password changed',
  'admin.siteName': 'Site name',
  'admin.invite': 'Invite code',
  'admin.invitePlaceholder': 'empty = open sign-up',
  'admin.defaultStake': 'Default stake',
  'admin.weights': 'Prediction weights',
  'admin.weightsHint': 'The match pot is split in proportion to weights. The bigger the exact-score weight relative to others, the bigger its prize.',
  'admin.saved': 'Saved',
  'admin.data': 'Data',
  'admin.export': 'Export JSON',
  'admin.exportHint': 'The whole database as one file (no passwords). Amounts are in hundredths of a point.',
  'admin.requireApproval': 'New players need approval',
  'admin.pending': 'Pending',
  'admin.edit': 'Edit',
  'admin.delete': 'Delete',
  'admin.password': 'Password',
  'admin.approve': 'Approve',
  'admin.reject': 'Reject',
  'admin.approved': '{user} approved',
  'admin.confirmReject': 'Reject and delete the account {user}?',
  'admin.rejected': 'Account deleted',
  'pending.title': 'Almost there',
  'pending.text': 'Account {user} has been created. An admin needs to approve it before you can make predictions.',
  'pending.check': 'Check again',
  'comments.button': 'Comments',
  'comments.empty': 'No comments yet.',
  'comments.placeholder': 'Thoughts on the match?',
  'comments.send': 'Send',
  'comments.delete': 'Delete',
  'comments.confirmDelete': 'Delete this comment?',
};

export const QUOTES = {
  uk: [
    '«Футбол — проста гра: 22 людини ганяються за мʼячем, а в кінці завжди виграють німці». — Г. Лінекер',
    '«Деякі люди вважають, що футбол — це питання життя і смерті. Все набагато серйозніше». — Б. Шенклі',
    '«Команда — це не набір зірок, а одна зірка». — В. Лобановський',
    '«Якщо ти не можеш виграти, зроби так, щоб не програв». — Й. Кройф',
    '«Мʼяч круглий, гра триває 90 хвилин». — С. Гербергер',
    'Ставки на поінти — це як ставки на гроші, тільки без грошей. І без ставок. 🤷',
    'Порада дня: ставте на перемогу тієї команди, яка заб’є більше.',
  ],
  en: [
    '"Football is a simple game: 22 men chase a ball for 90 minutes and at the end, the Germans always win." — G. Lineker',
    '"Some people believe football is a matter of life and death. I can assure you it is much, much more important than that." — B. Shankly',
    '"A team is not a collection of stars, it is one star." — V. Lobanovskyi',
    '"If you can\'t win, make sure you don\'t lose." — J. Cruyff',
    '"The ball is round, the game lasts 90 minutes." — S. Herberger',
    'Betting points is like betting money, just without the money. Or the betting. 🤷',
    'Tip of the day: bet on the team that scores more goals.',
  ],
};

const DICTS = { uk, en };
const LangContext = createContext(null);

// Ukrainian only for now; English strings are kept for later.
export let currentLang = 'uk';

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);
  const setLang = useCallback((l) => {
    currentLang = l;
    try {
      localStorage.setItem('lang', l);
    } catch {}
    document.documentElement.lang = l;
    setLangState(l);
  }, []);
  const value = useMemo(() => {
    const t = (key, params = {}) =>
      (DICTS[lang][key] ?? uk[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
    return { lang, setLang, t, locale: lang === 'uk' ? 'uk-UA' : 'en-GB' };
  }, [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useI18n = () => useContext(LangContext);
